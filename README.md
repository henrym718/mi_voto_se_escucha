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

### Cuentas de prueba

Solo existen en local. En la nube las crea el pipeline.

| Correo | Clave | Qué puede |
|---|---|---|
| `admin@local.test` | `local1234` | Todo, incluido gestionar al equipo |
| `editor@local.test` | `local1234` | Contenido, estados, aprobar pedidos |
| `candidato@local.test` | `local1234` | Solo mirar sus métricas |

Para entrar como vecino, los números `0990000001`, `0990000002` y `0990000003`
funcionan con el código `123456` y no gastan un WhatsApp real.

---

## Pruebas

```bash
pnpm smokes                                        # 206 comprobaciones SQL
node --env-file=.env.local scripts/e2e-vecino.mjs  # 28 con sesión real
```

Las **smokes** son SQL puro contra el Postgres local, cada suite envuelta en una
transacción que termina en `rollback`: la base queda intacta y se pueden correr
todas seguidas sin resetear.

- `smoke-territorio` — el catálogo del cantón y su configuración
- `smoke-rls` — se hace pasar por anónimo y por vecino y comprueba que **no**
  pueden hacer lo que no les toca
- `smoke-voto` — un apoyo por persona, y solo en la ciudadela propia
- `smoke-pedidos` — publicar y el bucle anti-duplicados
- `smoke-panel` — el tablero, los roles y la fusión de duplicados
- `smoke-notificaciones` — la cola, los reintentos y el freno anti-spam

El **recorrido del vecino** pasa por Supabase Auth de verdad, con token real:
pide el código, lo verifica, apoya, publica y comprueba que no puede tocar el
panel. Es lo que las suites SQL no pueden dar, porque allí se suplanta al
usuario con `set_config`.

Si una suite sale **VACÍA** (amarilla), algo se rompió antes de contar nada: un
verde vacío no es un verde.

---

## Cómo está armado

```
src/
  app/                        rutas y nada más
    (publico)/                portal, obras, publicar, /o/CODIGO
    panel/(protegido)/        tablero, cola, ranking, estados, difusión
  modules/<dominio>/          components · hooks · services · views · types
  components/ui/              shadcn
  shared/                     config, lib, providers
supabase/
  migrations/                 tablas + RLS + funciones de negocio
  functions/                  OTP por WhatsApp y worker de la cola
scripts/                      smokes, recorrido e2e, plantillas, cuentas
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

**Se apoya solo en la ciudadela propia.** Es lo que hace que el mapa de demanda
signifique algo: los 412 apoyos de Arbolito 2 son de gente de Arbolito 2. Si esa
regla se afloja, el producto deja de ser vendible.

**Los apoyos son ilimitados por persona.** Como el conteo crudo tiende a
aplanarse, en todos lados se muestra además **qué porcentaje de los vecinos
verificados de esa ciudadela** respalda cada obra. Así un barrio de 300 vecinos
con 210 apoyos pesa más que uno de 3.000 con 400.

**No existe un estado "No viable".** Ningún candidato en campaña va a publicar
en su propia página que la obra de un barrio no se puede hacer. Para eso están
los dos cierres suaves: "En estudio técnico" y "Proyectada a mediano plazo".
Cumplen la misma función —que nada quede en silencio— sin costo político.

**Los pedidos del PDOT no tienen apoyos inventados.** Están pre-cargados desde
el plan municipal con la fuente citada y en cero. Resuelven el arranque en frío
sin mentir: el vecino entra y encuentra su problema listo para apoyar en vez de
una página en blanco. Simular votos destruiría lo único que se vende.

**El padrón no se entrega ni se muestra.** El equipo ve agregados; los mensajes
salen desde la plataforma. No es solo por la ley de protección de datos: es lo
que sostiene la confianza que le da valor al dato.

**El tope de difusiones no se puede desactivar desde el panel.** Máximo dos por
vecino por semana. Si el equipo pudiera saltárselo, se lo saltaría en la primera
semana, los vecinos bloquearían el número y el activo se evaporaría. Los avisos
de las obras que cada quien apoyó no cuentan contra ese tope: esos siempre
llegan, porque los pidió él.

**El código de WhatsApp se pide al actuar, nunca al mirar.** Ver el ranking, las
obras y el portal no exige nada. Eso maximiza la conversión y, de paso, hace que
cada número del padrón sea de alguien que *hizo* algo.

---

## Desplegar

Ver [docs/desplegar-staging.md](docs/desplegar-staging.md).

Lo único que conviene recordar aquí: **las plantillas de WhatsApp se crean
primero de todo**, porque Meta tarda entre minutos y días en aprobarlas y sin la
plantilla del código nadie puede entrar.

Staging reconstruye la base entera en cada despliegue. Producción solo aplica
migraciones nuevas — un reset allí borraría el padrón.
