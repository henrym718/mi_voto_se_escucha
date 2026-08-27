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

No hay nada de WhatsApp que preparar. La plataforma no envía un solo mensaje:
los avisos colectivos van por los canales de WhatsApp del sector, que el equipo
crea a mano una vez y cuyos enlaces pega desde el panel (*Canales de WhatsApp*).

## 2. Claves del ayudante de IA

Ordena la nota de voz del vecino después de que la envía, para que el equipo
revise un borrador legible en vez de una transcripción cruda.

- `OPENAI_API_KEY` — Whisper, que oye la nota de voz.
- `GEMINI_API_KEY` — Gemini, que la ordena en título y descripción.

**No son bloqueantes.** Sin ellas el pedido entra igual, queda marcado
`fallido` en la cola y el equipo lo redacta a mano leyendo lo que el vecino
escribió o escuchando su audio. Nunca se pierde un pedido por una API caída.

Van como variables de entorno del proyecto en Vercel, no en los secretos de
GitHub: las usa el servidor de Next, no el pipeline.

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
| `STAGING_ADMIN_CORREO` | El correo con el que entrará el equipo |
| `STAGING_ADMIN_CLAVE` | Una contraseña larga; el pipeline crea la cuenta |

## 4. Vercel

1. Importar el repositorio, rama de producción `staging`.
2. Variables de entorno del proyecto:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `NEXT_PUBLIC_SITIO_URL`
   - `NEXT_PUBLIC_CIUDAD_POR_DEFECTO` = `el-triunfo`
   - `SUPABASE_SERVICE_ROLE_KEY` (sin `NEXT_PUBLIC_`; solo la usa el servidor)
   - `OPENAI_API_KEY` y `GEMINI_API_KEY` (sin `NEXT_PUBLIC_`)

## 5. Lanzar

```bash
git checkout -b staging
git push -u origin staging
```

El pipeline hace, en orden: tipos y compilación → smokes contra un Supabase
local del propio runner → reset de la base remota → configuración de auth
(sesiones anónimas y URL del sitio) → creación de la cuenta del equipo → smokes
otra vez, ahora contra staging de verdad.

## 6. Comprobar que quedó bien

1. Abrir el sitio: debe verse la portada con las 49 obras del PDOT cargadas.
2. **Tocar Apoyar en cualquier tarjeta.** El contador tiene que subir al
   instante y aparecer después el modal del teléfono.
   - Si no sube y la consola muestra un **422** contra `/auth/v1/signup`, las
     sesiones anónimas están apagadas en el proyecto. El pipeline las enciende
     por la Management API; si alguien las apagó desde el panel, volver a correr
     el despliegue.
   - Sin sesión anónima la portada se sigue viendo, así que el fallo es
     silencioso hasta que alguien intenta apoyar. Es lo primero que hay que
     probar.
3. Publicar un pedido con una nota de voz. Tiene que llegar a la cola del panel
   con el audio adjunto, esté o no la IA disponible.
4. Entrar al panel con la cuenta del equipo, mover una obra de columna y
   comprobar que el avance aparece en la línea de tiempo pública de esa obra.
5. En *Canales de WhatsApp*, pegar el enlace de un sector y comprobar que
   aparece el botón "Únete al canal" al terminar de publicar en ese sector.

---

## Producción, cuando llegue el momento

El mismo procedimiento con los secretos `PROD_*`, salvo una diferencia que
importa: el pipeline hace `db push`, **no** `db reset`. Un reset en producción
borraría el padrón de vecinos, que es el activo del negocio.
