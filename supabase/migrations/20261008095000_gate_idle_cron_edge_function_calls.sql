-- Skip Edge Function invocations when there is provably nothing to do. Each gate is a superset of the
-- function's real work set (video-poll: status='processing' with provider_request_id; comfyui-poll: processing|waiting).
do $g$ declare r record; cond text; newcmd text;
  c_video  text := $$EXISTS (SELECT 1 FROM public.generations WHERE status = 'processing' AND provider_request_id IS NOT NULL)$$;
  c_comfy  text := $$EXISTS (SELECT 1 FROM public.generations WHERE status IN ('processing','waiting') AND provider_request_id IS NOT NULL)$$;
  c_email  text := $$EXISTS (SELECT 1 FROM public.email_campaigns WHERE status NOT IN ('sent','failed','draft','cancelled'))$$;
  c_agentx text := $$EXISTS (SELECT 1 FROM public.agent_x_projects WHERE status NOT IN ('COMPLETED','FAILED','CANCELLED'))$$;
begin
  for r in select jobid, command from cron.job where jobid in (14,16,19,20,22) loop
    continue when r.command like '%WHERE EXISTS%';
    cond := case r.jobid when 16 then c_video when 14 then c_email when 22 then c_agentx else c_comfy end;
    newcmd := regexp_replace(r.command, 'SELECT pg_sleep\(30\);', 'SELECT pg_sleep(30) WHERE ' || cond || ';');
    newcmd := regexp_replace(newcmd, '\)\s*;\s*$', E')\n  WHERE ' || cond || ';');
    perform cron.alter_job(r.jobid, command := newcmd);
  end loop; end $g$;
