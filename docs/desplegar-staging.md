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
local del propio runner → reset de la base remota → reconciliación de Edge
Functions → configuración de auth (sesiones anónimas y URL del sitio) → creación
de la cuenta del equipo → smokes otra vez, ahora contra staging de verdad →
datos de demostración.

**No hay ningún paso manual.** El reset deja la base igual al código, y el paso
de reconciliación hace lo mismo con las Edge Functions y sus secretos, que no
viven en la base y por eso ningún reset los alcanza: borra del proyecto las que
ya no están en `supabase/functions/` y despliega las que sí. Hoy no hay ninguna,
así que su trabajo es dejar el proyecto sin ninguna — incluidas las del OTP, si
alguna vez se desplegaron.

## 6. Datos de demostración

El último paso del pipeline corre `scripts/datos-de-prueba.mjs`, que llena
staging para poder mirarla: 120 vecinos con teléfono repartidos por sector
según su población, unos 450 apoyos, ocho pedidos esperando en la cola, las
obras más apoyadas movidas por el tablero con su avance y su foto, y las fichas
del equipo con retrato.

**Vive fuera del seed a propósito.** `supabase/seed.sql` lo aplica cualquier
reset, incluido el de producción en modo prelanzamiento, y ahí solo puede haber
lo que aguanta el día del lanzamiento: las ciudadelas del PDOT y sus 49
carencias documentadas, con la fuente citada y cero apoyos. Los vecinos
inventados son otra cosa y por eso los pone una llamada explícita que solo
existe en el workflow de staging.

Va **después** de los smokes, no antes: las suites comprueban que el ambiente
quedó igual a lo que dice el código, y una de ellas exige que ningún sector
nazca con enlace de canal puesto. Sembrando primero, esa comprobación mediría
el relleno en vez del despliegue.

Las fotos salen de [Lorem Picsum](https://picsum.photos) y
[Pravatar](https://pravatar.cc) —ninguna pide clave— y se **suben a los buckets
del propio proyecto** en vez de enlazarse: el ambiente no depende de que un
servicio ajeno siga en pie, y de paso el despliegue prueba que el
almacenamiento quedó bien. Si la descarga falla, el registro entra sin foto y
el pipeline sigue en verde.

Lo que el script **no** inventa son los enlaces de canal de WhatsApp: uno
sembrado abriría un error en la cara del vecino justo después de apoyar. Se
siguen pegando a mano desde el panel.

Para correrlo contra una base local:

```bash
pnpm supabase:reset && SUPABASE_URL=http://127.0.0.1:54321 SUPABASE_SERVICE_ROLE_KEY=<clave> pnpm datos:prueba
```

Se planta si la base ya tiene vecinos —o son de otra corrida y los duplicaría,
o son reales— salvo que se le pase `--forzar`. Con `DATOS_SIN_FOTOS=1` siembra
sin tocar internet.

## 7. Comprobar que quedó bien

1. Abrir el sitio: debe verse la portada con las obras cargadas y los
   contadores de apoyos, causas y vecinos en pie.
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
