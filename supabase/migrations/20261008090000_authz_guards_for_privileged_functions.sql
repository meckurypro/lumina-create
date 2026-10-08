-- Authorization guards for SECURITY DEFINER functions callable from the browser.
-- Rule: a caller coming through the public API (anon/authenticated JWT) may only act as themselves
-- (or as admin where the function is admin-only). Service role, cron and internal calls are trusted.
-- The guard is injected as the first statement of each function; existing logic is untouched.

create or replace function public._caller_is_trusted() returns boolean language sql stable as $$
  select coalesce(nullif(auth.jwt() ->> 'role', ''), 'service_role') = 'service_role'
$$;
create or replace function public._assert_self(p uuid) returns void language plpgsql stable as $$
begin
  if public._caller_is_trusted() then return; end if;
  if auth.uid() is not null and auth.uid() = p then return; end if;
  raise exception 'forbidden' using errcode = '42501';
end $$;
create or replace function public._assert_admin() returns void language plpgsql stable as $$
begin
  if public._caller_is_trusted() then return; end if;
  if public.is_admin() then return; end if;
  raise exception 'forbidden' using errcode = '42501';
end $$;
create or replace function public._assert_self_or_admin(p uuid) returns void language plpgsql stable as $$
begin
  if public._caller_is_trusted() then return; end if;
  if auth.uid() is not null and auth.uid() = p then return; end if;
  if public.is_admin() then return; end if;
  raise exception 'forbidden' using errcode = '42501';
end $$;
revoke all on function public._caller_is_trusted(), public._assert_self(uuid), public._assert_admin(), public._assert_self_or_admin(uuid) from public, anon, authenticated;
grant execute on function public._caller_is_trusted(), public._assert_self(uuid), public._assert_admin(), public._assert_self_or_admin(uuid) to service_role;

do $p$
declare
  r record; def text; newdef text; call text;
  self_map jsonb := '{"deduct_credits":"p_user_id","join_cohort_by_code":"p_user_id","join_render_window_code":"p_user_id",
    "join_render_window_team":"p_user_id","leave_cohort":"p_user_id","get_my_cohort_as_member":"p_user_id","toggle_feed_like":"p_user_id",
    "submit_booking_reconfig":"p_user_id","record_team_seat_usage":"p_user_id","claim_pod_queue_job_for_serverless":"p_user_id",
    "get_active_models_if_eligible":"p_user_id","process_iqads_order_payment":"p_user_id","deduct_staff_pool":"p_staff_id",
    "remove_render_window_team_member":"p_owner_id","reset_render_window_team_code":"p_owner_id"}';
  admin_only text[] := array['get_admin_stats','get_staff_summary','get_render_window_admin_summary','run_novice_storage_cleanup',
    'admin_get_user_email','get_user_emails','admin_search_users','update_model_pricing'];
  self_or_admin text[] := array['get_staff_all_tool_access','get_staff_tool_access'];
  skipped text[] := '{}'; patched int := 0;
begin
  for r in
    select p.oid, p.proname, l.lanname, pg_get_function_arguments(p.oid) as args
    from pg_proc p join pg_language l on l.oid = p.prolang
    where p.pronamespace = 'public'::regnamespace and p.prokind = 'f' and p.proname not like '\_%'
      and (p.proname = any(admin_only) or p.proname = any(self_or_admin) or self_map ? p.proname
           or pg_get_function_arguments(p.oid) like '%p_admin_id%')
  loop
    call := case
      when r.proname = any(admin_only)    then 'PERFORM public._assert_admin();'
      when r.proname = any(self_or_admin) then 'PERFORM public._assert_self_or_admin(p_staff_id);'
      when r.args like '%p_admin_id%'      then 'PERFORM public._assert_self(p_admin_id);'
      else 'PERFORM public._assert_self(' || (self_map ->> r.proname) || ');' end;
    def := pg_get_functiondef(r.oid);
    if r.lanname <> 'plpgsql' or def like '%public._assert_%' then skipped := skipped || r.proname::text; continue; end if;
    newdef := regexp_replace(def, '\mBEGIN\M', 'BEGIN' || E'\n  ' || call, 'i');
    if newdef = def then skipped := skipped || r.proname::text; continue; end if;
    execute newdef;
    execute format('alter function %s set search_path = public, extensions, pg_temp', r.oid::regprocedure);
    patched := patched + 1;
  end loop;
  raise notice 'patched=% skipped=%', patched, skipped;
end $p$;
