-- ============================================================================
-- El reloj que drena la cola de WhatsApp.
--
-- Cada minuto invoca al worker, que toma un lote, lo envía y reintenta lo que
-- falla. La URL y el secreto salen del Vault, no del código: así el mismo
-- archivo sirve en local, staging y producción, y el pipeline es quien pone
-- los valores de cada ambiente.
--
-- En local no hay Vault configurado y la tarea simplemente no hace nada; el
-- worker se prueba a mano con `supabase functions serve`.
-- ============================================================================

create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

create or replace function public.disparar_worker_notificaciones()
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_url     text;
  v_secreto text;
begin
  -- Si el ambiente no tiene los secretos puestos, no se hace nada. Sin esto,
  -- cada minuto quedaría un error en el registro que no le importa a nadie.
  begin
    select decrypted_secret into v_url
      from vault.decrypted_secrets where name = 'url_base_funciones';
    select decrypted_secret into v_secreto
      from vault.decrypted_secrets where name = 'secreto_worker';
  exception when others then
    return;
  end;

  if v_url is null or v_secreto is null then
    return;
  end if;

  perform net.http_post(
    url     := v_url || '/worker-notificaciones',
    headers := jsonb_build_object(
                 'Content-Type', 'application/json',
                 'Authorization', 'Bearer ' || v_secreto
               ),
    body    := '{}'::jsonb,
    timeout_milliseconds := 55000
  );
end;
$$;

revoke execute on function public.disparar_worker_notificaciones() from public, anon, authenticated;

-- Cada minuto. Es el intervalo que hace que un aviso se sienta inmediato sin
-- despertar a la base cada pocos segundos.
select cron.schedule(
  'drenar-cola-whatsapp',
  '* * * * *',
  $cron$ select public.disparar_worker_notificaciones(); $cron$
);
