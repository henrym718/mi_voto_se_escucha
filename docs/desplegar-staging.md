# Desplegar a staging

Todo lo de aquí se hace una sola vez por ambiente. Después, cada empujón a la
rama `staging` despliega solo.

Regla que gobierna este documento: **nada se escribe a mano en el panel de
Supabase.** Si un valor solo vive en la interfaz, se pierde en el siguiente
reset y nadie recuerda de dónde salió. Todo entra por el pipeline.

---

## 1. Crear el proyecto de Supabase

1. Crear un proyecto nuevo en Supabase, región **East US (North Virginia)** o la
   más cercana a Ecuador con buena latencia.
2. Anotar la **referencia del proyecto** (el código que aparece en la URL) y la
   **contraseña de la base**.
3. En *Project Settings → API*, copiar la **anon key**, la **service_role key** y
   la **URL del proyecto**.
4. En *Project Settings → Database*, copiar la **cadena de conexión** en modo
   sesión (la que empieza con `postgresql://postgres...`).

## 2. Preparar las plantillas de WhatsApp

**Esto va primero de todo**, porque Meta tarda entre minutos y días en aprobar.
Si se deja para el final, el lanzamiento se queda esperando.

```bash
node --env-file=.env.staging scripts/crear-plantillas-whatsapp.mjs crear
```

Y para ver cómo van:

```bash
node --env-file=.env.staging scripts/crear-plantillas-whatsapp.mjs ver
```

Se crean cinco: `mvse_staging_otp` (de tipo autenticación, la del código),
`mvse_staging_obra_avance`, `mvse_staging_obra_top`,
`mvse_staging_obra_publicada` y `mvse_staging_difusion`.

Hasta que `otp` esté aprobada, nadie puede entrar. Es la ruta crítica.

## 3. Variables del repositorio en GitHub

En *Settings → Secrets and variables → Actions*.

### Variables (`vars`) — no son secretas

| Nombre | Valor de ejemplo |
|---|---|
| `STAGING_PROJECT_REF` | `abcdefghijklmnop` |
| `STAGING_SUPABASE_URL` | `https://abcdefghijklmnop.supabase.co` |
| `STAGING_SITIO_URL` | `https://mvse-staging.vercel.app` |

### Secretos (`secrets`)

| Nombre | De dónde sale |
|---|---|
| `SUPABASE_ACCESS_TOKEN` | Token personal de la cuenta de Supabase (*Account → Access Tokens*) |
| `STAGING_SUPABASE_ANON_KEY` | Project Settings → API |
| `STAGING_SERVICE_ROLE_KEY` | Project Settings → API |
| `STAGING_DB_URL` | Cadena de conexión con la contraseña puesta |
| `KAPSO_API_KEY` | Kapso → Project Settings → API Keys |
| `KAPSO_PHONE_NUMBER_ID` | Kapso → el id del **número emisor** (no el de la cuenta) |
| `STAGING_SEND_SMS_HOOK_SECRET` | Se genera: ver abajo |
| `STAGING_WORKER_SECRET` | Se genera: ver abajo |
| `STAGING_ADMIN_CORREO` | El correo con el que entrará el equipo |
| `STAGING_ADMIN_CLAVE` | Una contraseña larga; el pipeline crea la cuenta |

Los dos que hay que generar:

```bash
# Firma del hook de OTP. El prefijo v1,whsec_ es obligatorio.
echo "v1,whsec_$(openssl rand -base64 32 | tr -d '=+/' | cut -c1-40)"

# Secreto que autoriza al cron a invocar el worker.
openssl rand -hex 32
```

## 4. Archivo local para los scripts

Los pipelines no lo necesitan; sirve para correr a mano el script de plantillas
y para depurar. **No se sube al repositorio.**

Guardar como `.env.staging`:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://TU_REF.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_CIUDAD_POR_DEFECTO=el-triunfo
NEXT_PUBLIC_SITIO_URL=https://mvse-staging.vercel.app

KAPSO_API_KEY=
KAPSO_PHONE_NUMBER_ID=
KAPSO_BUSINESS_ACCOUNT_ID=
KAPSO_TEMPLATE_PREFIX=mvse_staging
KAPSO_TEMPLATE_LANG=es
APP_BASE_URL=https://mvse-staging.vercel.app

SEND_SMS_HOOK_SECRET=v1,whsec_...
WORKER_SECRET=
```

## 5. Vercel

1. Importar el repositorio, rama de producción `staging`.
2. Variables de entorno del proyecto:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `NEXT_PUBLIC_SITIO_URL`
   - `NEXT_PUBLIC_CIUDAD_POR_DEFECTO` = `el-triunfo`
   - `SUPABASE_SERVICE_ROLE_KEY` (sin `NEXT_PUBLIC_`; solo la usa el servidor)

## 6. Lanzar

```bash
git checkout -b staging
git push -u origin staging
```

El pipeline hace, en orden: tipos y compilación → smokes y recorrido del vecino
→ reset de la base → secretos al Vault → secretos de las funciones → despliegue
de funciones → configuración de auth con el hook de WhatsApp → creación de la
cuenta del equipo.

## 7. Comprobar que quedó bien

1. Abrir el sitio: debe verse el portal con las 49 obras del PDOT cargadas.
2. Apoyar una obra con un número real: el código tiene que llegar por WhatsApp.
   - Si no llega, mirar los registros de `enviar-otp-whatsapp` en Supabase.
   - `401` en el hook = la firma no coincide, revisar `SEND_SMS_HOOK_SECRET`.
   - `404` en Kapso = `KAPSO_PHONE_NUMBER_ID` vacío o mal.
   - `132001` = la plantilla no está aprobada o el idioma no es `es`.
3. Entrar al panel con la cuenta del equipo y mover una obra de columna.
4. Comprobar que llega el aviso por WhatsApp. Si no, revisar los registros del
   worker y la tabla `notificaciones`: la columna `ultimo_error` dice qué pasó.

Los números `593990000001` y `593990000002` funcionan en staging con el código
`123456` y **no gastan un WhatsApp real**. Sirven para probar sin quemar saldo.

---

## Producción, cuando llegue el momento

El mismo procedimiento con los secretos `PROD_*`, salvo dos diferencias que
importan:

- El pipeline hace `db push`, **no** `db reset`. Un reset en producción borraría
  el padrón de vecinos verificados, que es el activo del negocio.
- El prefijo de plantillas es `mvse_prod`, así que hay que crearlas y esperar
  aprobación otra vez, con el dominio real en `APP_BASE_URL`.
