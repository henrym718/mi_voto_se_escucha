# Mi Voto Se Escucha

Plataforma cívica donde los vecinos de un cantón piden las obras que hacen falta
en su barrio y apoyan las de los demás. Las más apoyadas entran al plan de obras
del candidato o de la alcaldía.

Se vende **en exclusiva a un partido por ciudad**, con un dominio por ciudad y
el mismo código para todas. Piloto: **El Triunfo, Guayas**.

---

## Arrancar en local

```bash
pnpm install
pnpm supabase start
pnpm dev
```

`supabase start` aplica las migraciones y carga el seed: El Triunfo con sus 75
ciudadelas reales, 10 categorías, 6 estados y 49 pedidos pre-cargados desde el
plan de desarrollo municipal.

Las claves locales van en `.env.local` (ver `.env.example`).

### Entrar como vecino

No hay nada que hacer: se abre la página y ya. El navegador crea una sesión
anónima de Supabase en silencio, y con eso el vecino puede apoyar y publicar sin
registrarse. El teléfono se pide una sola vez, **después** del primer apoyo, y
se puede saltar.

### Cuentas del equipo

Solo existen en local. En la nube las crea el pipeline.

| Correo | Clave | Qué puede |
|---|---|---|
| `admin@local.test` | `local1234` | Todo, incluido gestionar al equipo |
| `editor@local.test` | `local1234` | Contenido, estados, aprobar pedidos |
| `candidato@local.test` | `local1234` | Solo mirar sus métricas |

---

## Pruebas

```bash
pnpm smokes        # 237 comprobaciones SQL
pnpm verificar     # tipos + lint + smokes
```

Las **smokes** son SQL puro contra el Postgres local, cada suite envuelta en una
transacción que termina en `rollback`: la base queda intacta y se pueden correr
todas seguidas sin resetear. Las mismas suites corren contra staging después de
desplegarlo, con `MVSE_DB_URL`.

- `smoke-territorio` — el catálogo del cantón y su configuración
- `smoke-rls` — se hace pasar por anónimo y por vecino y comprueba que **no**
  pueden hacer lo que no les toca
- `smoke-voto` — un apoyo por persona, la sesión anónima y la captura del número
- `smoke-pedidos` — publicar hablando o escribiendo, y sus límites
- `smoke-panel` — el tablero, los roles, la cola y la fusión de duplicados
- `smoke-portal` — la portada editable y las fichas del equipo
- `smoke-canales` — los enlaces de canal y la única salida de teléfonos

Si una suite sale **VACÍA** (amarilla), algo se rompió antes de contar nada: un
verde vacío no es un verde. Y una suite con comprobaciones en rojo sale roja
aunque `psql` termine en cero — las comprobaciones se registran en una tabla, no
lanzan error, y el runner las cuenta aparte.

---

## Cómo está armado

```
src/
  app/                        rutas y nada más
    (publico)/                portada, obras, publicar, perfiles, /o/CODIGO
    panel/(protegido)/        tablero, cola, ranking, estados, contenido, canales
    api/ia/procesar-pedido/   ordena la nota de voz DESPUÉS de responder
  modules/<dominio>/          components · hooks · services · views · types
  components/ui/              shadcn
  shared/                     config, lib, providers
supabase/
  migrations/                 tablas + RLS + funciones de negocio
scripts/                      smokes y alta de cuentas del equipo
```

Reglas que se siguen en todo el proyecto:

- **`page.tsx` es solo router**: lee parámetros y renderiza la vista del módulo.
- **Ningún componente habla con Supabase**: todo pasa por `services/`.
- **Toda escritura pasa por una función de la base** en `security definer`. Las
  reglas de negocio viven en Postgres, no en el navegador, donde cualquiera las
  esquivaría.
- **Toda tabla nace con su RLS** y sus políticas en la misma migración.
- **En desarrollo una función se edita en su sitio**, nunca se duplica como
  `_v2`. En producción los cambios entran como migración nueva.

---

## Las decisiones que hay que conocer antes de tocar nada

**No hay registro, y no lo va a haber.** El vecino entra con una sesión anónima
que el navegador crea sola; eso le da un `auth.uid()` estable —y con él "un
apoyo por persona", su carpeta en storage y todas las políticas RLS— sin pedirle
un solo dato. Un formulario delante del botón Apoyar se lleva a la mayoría de la
gente, y ese botón es el producto entero.

**El teléfono se pide después de actuar, nunca antes, y se puede saltar.** Nadie
lo verifica: es un dato de contacto, no una credencial. Por eso NO es único —si
alguien teclea mal un número, o el de un vecino, el dueño real no puede quedar
fuera del sistema.

**Se apoya en todo el cantón, no solo en el barrio propio.** La portada abre en
"Todo el cantón / Más apoyadas" y el botón tiene que funcionar en cada tarjeta.
El mapa de demanda sigue limpio porque una obra pertenece al sector donde está
el problema, no al de quien la apoya; y el ranking del panel calcula el
porcentaje **solo con los apoyos de gente de ese sector**, que es el número
estricto y el que sirve para decidir.

**El vecino no espera a ninguna IA.** Graba veinte segundos, toca Enviar y ve
"recibido". El servidor transcribe y redacta después, con `after()`, y el equipo
revisa el borrador en su cola con el audio al lado. Si el proveedor está caído,
la obra queda marcada `fallido` y se redacta a mano: **nunca se pierde un
pedido** por culpa de una API.

**No existe un estado "No viable".** Ningún candidato en campaña va a publicar
en su propia página que la obra de un barrio no se puede hacer. Para eso están
los dos cierres suaves: "En estudio técnico" y "Proyectada a mediano plazo".
Cumplen la misma función —que nada quede en silencio— sin costo político.

**Los pedidos del PDOT no tienen apoyos inventados.** Están pre-cargados desde
el plan municipal con la fuente citada y en cero. Resuelven el arranque en frío
sin mentir: el vecino entra y encuentra su problema listo para apoyar en vez de
una página en blanco. Simular votos destruiría lo único que se vende.

**No se manda un solo WhatsApp desde el sistema.** A dos a cinco centavos por
mensaje, avisar cada cambio de estado a mil vecinos se come el presupuesto de
campaña en avisos de trámite que a nadie le mueven el voto. El avance se
consulta en la propia página de la obra, que es gratis, y lo colectivo se
publica en el **canal de WhatsApp del sector**: uno a muchos, costo cero. El
equipo pega esos enlaces desde el panel y el vecino entra de un toque desde su
pantalla de confirmación.

**El padrón sale por una sola puerta.** `admin_contactos_sector`: por sector,
solo para quien puede editar, y dejando constancia en la bitácora de quién lo
sacó. No es solo por la ley de protección de datos: es lo que sostiene la
confianza que le da valor al dato.

---

## Desplegar

Ver [docs/desplegar-staging.md](docs/desplegar-staging.md).

Lo único que conviene recordar aquí: **el proyecto de la nube necesita las
sesiones anónimas encendidas**. El pipeline las activa por la Management API en
cada despliegue; si alguien las apaga en el panel, la portada se sigue viendo
pero el botón Apoyar responde 422 en cada toque.

Staging reconstruye la base entera en cada despliegue. Producción solo aplica
migraciones nuevas — un reset allí borraría el padrón.
