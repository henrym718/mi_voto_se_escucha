-- ============================================================================
-- Barrido del envío saliente de WhatsApp.
--
-- Las tablas y funciones de la cola se fueron reescribiendo sus migraciones,
-- pero eso NO alcanza para un proyecto que ya se desplegó con el sistema viejo:
-- el trabajo de pg_cron vive en el esquema `cron` y los secretos en `vault`, y
-- ninguno de los dos lo toca un `db reset` del esquema público.
--
-- Sin este barrido, un proyecto que ya tuvo el worker se queda con una tarea
-- llamando cada minuto a una función que ya no existe: un error por minuto en
-- los registros, para siempre, y las credenciales de Kapso siguen guardadas en
-- el Vault sin que nadie las use.
--
-- Es idempotente y no falla en un proyecto nuevo, donde no hay nada que barrer.
-- ============================================================================

-- El worker y su reloj ------------------------------------------------------
do $limpiar_cron$
begin
  -- Se consulta con EXECUTE a propósito: en un proyecto sin pg_cron, nombrar
  -- `cron.job` directamente reventaría al ejecutar el bloque.
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    if (select count(*) from pg_namespace where nspname = 'cron') > 0 then
      execute $q$
        do $inner$
        begin
          if exists (select 1 from cron.job where jobname = 'drenar-cola-whatsapp') then
            perform cron.unschedule('drenar-cola-whatsapp');
          end if;
        end
        $inner$;
      $q$;
    end if;
  end if;
exception when others then
  -- Un proyecto sin permisos sobre `cron` no debe tumbar el despliegue entero.
  raise notice 'No se pudo quitar la tarea drenar-cola-whatsapp: %', sqlerrm;
end
$limpiar_cron$;

drop function if exists public.disparar_worker_notificaciones();

-- Las credenciales que ya no usa nadie ---------------------------------------
do $limpiar_vault$
begin
  if exists (select 1 from pg_namespace where nspname = 'vault') then
    execute $q$delete from vault.secrets where name in ('url_base_funciones', 'secreto_worker')$q$;
  end if;
exception when others then
  raise notice 'No se pudieron borrar los secretos del Vault: %', sqlerrm;
end
$limpiar_vault$;
