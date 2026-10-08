-- Remove anonymous (and, for server-only money functions, signed-in) access to privileged functions.
-- Access was inherited from the PUBLIC pseudo-role, so revoke there and re-grant explicitly.
do $h1$ declare f record; begin
  for f in select p.oid::regprocedure as sig from pg_proc p where p.pronamespace = 'public'::regnamespace
    and p.proname in ('add_credits','refund_credits','award_referral_commission','process_render_window_booking_payment',
                      'process_render_window_subscription','process_render_window_team_purchase')
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', f.sig);
    execute format('grant execute on function %s to service_role', f.sig);
  end loop; end $h1$;
do $h2$ declare f record; begin
  for f in select p.oid::regprocedure as sig from pg_proc p where p.pronamespace = 'public'::regnamespace
    and (p.proname like 'admin\_%' or p.proname in ('deduct_credits','deduct_staff_pool','promote_to_staff','demote_from_staff',
      'update_model_pricing','process_iqads_order_payment','get_user_emails','get_admin_stats','get_staff_summary',
      'get_staff_all_tool_access','get_staff_tool_access','get_render_window_active_members','get_render_window_admin_summary',
      'get_render_window_analytics','get_render_window_eligible_users_for_date','save_prompt_version','rollback_prompt_version',
      'toggle_template_visibility','approve_feed_post','reject_feed_post','remove_feed_post','run_novice_storage_cleanup',
      'reset_render_window_team_code','remove_render_window_team_member','claim_pod_queue_job_for_serverless',
      'record_team_seat_usage','submit_booking_reconfig'))
  loop
    execute format('revoke execute on function %s from public, anon', f.sig);
    execute format('grant execute on function %s to authenticated, service_role', f.sig);
  end loop; end $h2$;
