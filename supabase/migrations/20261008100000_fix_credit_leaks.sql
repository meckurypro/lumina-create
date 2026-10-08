-- Credit-integrity fixes (found via security audit, Oct 2026).
-- 1. Refunds are capped at what was actually charged for that generation (and refused if nothing was).
-- 2. Clients cannot rewrite money fields on generations or reopen a completed generation.
-- 3. Users cannot change their own plan tier on profiles.

create or replace function public.refund_credits(p_user_id uuid, p_generation_id uuid, p_amount numeric,
  p_description text default 'Generation failed — credits refunded')
returns jsonb language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare v_current numeric; v_new numeric; v_paid numeric; v_amount numeric := p_amount;
begin
  if p_generation_id is not null then
    select coalesce(-sum(amount), 0) into v_paid from credit_transactions
     where generation_id = p_generation_id and (type::text = 'usage' or type::text like 'staff%');
    if v_paid <= 0 then return jsonb_build_object('success', false, 'error', 'No charge to refund'); end if;
    v_amount := least(p_amount, v_paid);
  end if;
  select credits into v_current from profiles where id = p_user_id for update;
  if not found then return jsonb_build_object('success', false, 'error', 'User not found'); end if;
  v_new := v_current + v_amount;
  begin
    insert into credit_transactions (user_id, generation_id, type, status, amount, balance_before, balance_after, description)
    values (p_user_id, p_generation_id, 'refund', 'completed', v_amount, v_current, v_new, p_description);
  exception when unique_violation then
    return jsonb_build_object('success', false, 'error', 'Already refunded');
  end;
  update profiles set credits = v_new, total_credits_used = greatest(0, total_credits_used - v_amount),
         total_generations = greatest(0, total_generations - 1), updated_at = now() where id = p_user_id;
  return jsonb_build_object('success', true, 'credits_refunded', v_amount, 'balance_after', v_new);
end $$;

create or replace function public.handle_generation_failure() returns trigger
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare v_res jsonb;
begin
  if NEW.status = 'failed' and OLD.status <> 'failed' and NEW.credits_charged > 0 then
    if NEW.is_staff_generation and NEW.pool_user_id is not null then
      v_res := refund_credits(NEW.pool_user_id, NEW.id, NEW.credits_charged, 'Staff generation failed — credits refunded to pool');
    else
      v_res := refund_credits(NEW.user_id, NEW.id, NEW.credits_charged, 'Generation failed — credits automatically refunded');
    end if;
    if coalesce((v_res ->> 'success')::boolean, false) then
      insert into notifications (user_id, title, body, type)
      values (NEW.user_id, 'Generation Failed', 'Your generation failed. Credits have been refunded.', 'warning');
    end if;
  end if;
  return NEW;
end $$;

create or replace function public.generations_guard_client_updates() returns trigger
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
begin
  if public._caller_is_trusted() then return NEW; end if;
  if NEW.credits_charged is distinct from OLD.credits_charged or NEW.user_id is distinct from OLD.user_id
     or NEW.is_staff_generation is distinct from OLD.is_staff_generation or NEW.pool_user_id is distinct from OLD.pool_user_id then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if OLD.status = 'completed' and NEW.status is distinct from OLD.status then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return NEW;
end $$;
drop trigger if exists generations_guard_client_updates on public.generations;
create trigger generations_guard_client_updates before update on public.generations
  for each row execute function public.generations_guard_client_updates();

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles for update to public
  using (id = auth.uid())
  with check (id = auth.uid()
    and role is not distinct from (select p.role from profiles p where p.id = auth.uid())
    and is_staff is not distinct from (select p.is_staff from profiles p where p.id = auth.uid())
    and credits is not distinct from (select p.credits from profiles p where p.id = auth.uid())
    and user_tier is not distinct from (select p.user_tier from profiles p where p.id = auth.uid())
    and tier_started_at is not distinct from (select p.tier_started_at from profiles p where p.id = auth.uid())
    and tier_expires_at is not distinct from (select p.tier_expires_at from profiles p where p.id = auth.uid()));
