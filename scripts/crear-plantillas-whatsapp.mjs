// ============================================================================
// Crea, inspecciona y borra las plantillas de WhatsApp en Kapso/Meta.
//
// Meta tarda entre minutos y días en aprobar una plantilla, así que esto se
// corre AL PRINCIPIO de montar un ambiente, no el día del lanzamiento.
//
//   node --env-file=.env.local scripts/crear-plantillas-whatsapp.mjs crear
//   node --env-file=.env.local scripts/crear-plantillas-whatsapp.mjs ver
//   node --env-file=.env.local scripts/crear-plantillas-whatsapp.mjs borrar obra_avance
//
// Variables: KAPSO_API_KEY, KAPSO_BUSINESS_ACCOUNT_ID (el id de la cuenta de
// WhatsApp Business, NO el del número), KAPSO_TEMPLATE_PREFIX, APP_BASE_URL.
// ============================================================================

const KAPSO_BASE = 'https://api.kapso.ai/meta/whatsapp/v24.0';

const API_KEY = process.env.KAPSO_API_KEY;
const CUENTA = process.env.KAPSO_BUSINESS_ACCOUNT_ID;
const PREFIJO = process.env.KAPSO_TEMPLATE_PREFIX ?? 'mvse_staging';
const IDIOMA = process.env.KAPSO_TEMPLATE_LANG ?? 'es';
const URL_APP = (process.env.APP_BASE_URL ?? 'https://mivotoseescucha-eltriunfo.com').replace(/\/$/, '');

/** Cuerpo con variables con nombre. El ejemplo es obligatorio para Meta. */
const cuerpo = (texto, ejemplos) => ({
  type: 'BODY',
  text: texto,
  ...(ejemplos.length
    ? {
        example: {
          body_text_named_params: ejemplos.map(([param_name, example]) => ({ param_name, example })),
        },
      }
    : {}),
});

/**
 * Botón de enlace. Meta admite UNA sola variable y tiene que ir al final, por
 * eso el dominio va fijo y solo viaja la ruta (o/K3M9PX).
 */
const boton = (texto, ejemploRuta) => ({
  type: 'BUTTONS',
  buttons: [
    { type: 'URL', text: texto, url: `${URL_APP}/{{1}}`, example: [`${URL_APP}/${ejemploRuta}`] },
  ],
});

const PLANTILLAS = [
  {
    clave: 'obra_avance',
    categoria: 'UTILITY',
    componentes: [
      cuerpo(
        'Novedades de la obra que apoyaste en *{{ciudadela}}*.\n\n*{{obra}}*\nAhora está en: *{{estado}}*\n\n{{mensaje}}',
        [
          ['ciudadela', 'Arbolito 2'],
          ['obra', 'Alcantarillado calle principal'],
          ['estado', 'Comprometida'],
          ['mensaje', 'Los escuché en el recorrido del sábado. Esta obra va en mi plan.'],
        ],
      ),
      boton('Ver el avance', 'o/K3M9PX'),
    ],
  },
  {
    clave: 'obra_top',
    categoria: 'UTILITY',
    componentes: [
      cuerpo(
        'La obra que apoyaste ya es de las más pedidas de *{{ciudadela}}*.\n\n*{{obra}}*\nVa en el puesto *{{posicion}}* del barrio.\n\nCompártela con tus vecinos para que suba más.',
        [
          ['ciudadela', 'Arbolito 2'],
          ['obra', 'Alcantarillado calle principal'],
          ['posicion', '2'],
        ],
      ),
      boton('Ver la obra', 'o/K3M9PX'),
    ],
  },
  {
    clave: 'obra_publicada',
    categoria: 'UTILITY',
    componentes: [
      cuerpo(
        'Tu pedido ya está publicado en Mi Voto Se Escucha *{{ciudad}}*.\n\n*{{obra}}*\n\nCompártelo con tus vecinos: mientras más apoyos tenga, más arriba llega en la lista del barrio.',
        [
          ['ciudad', 'El Triunfo'],
          ['obra', 'Rejilla dañada en la calle 4'],
        ],
      ),
      boton('Compartir mi pedido', 'o/K3M9PX'),
    ],
  },
  {
    clave: 'difusion',
    categoria: 'UTILITY',
    componentes: [
      cuerpo('Mi Voto Se Escucha *{{ciudad}}*\n\n{{mensaje}}', [
        ['ciudad', 'El Triunfo'],
        ['mensaje', 'Este sábado a las 10 el candidato recorre tu sector.'],
      ]),
      boton('Abrir', 'obras'),
    ],
  },
  {
    // De tipo AUTHENTICATION: es la única categoría que Meta aprueba para
    // códigos de acceso, y trae su propio botón de copiar.
    clave: 'otp',
    categoria: 'AUTHENTICATION',
    componentes: [
      { type: 'BODY', add_security_recommendation: true },
      { type: 'FOOTER', code_expiration_minutes: 10 },
      {
        type: 'BUTTONS',
        buttons: [{ type: 'OTP', otp_type: 'COPY_CODE', text: 'Copiar código' }],
      },
    ],
  },
];

/** Que el texto y los ejemplos cuadren, antes de gastar una llamada a Meta. */
function validar(plantilla) {
  const bloque = plantilla.componentes.find((c) => c.type === 'BODY');
  if (!bloque?.text) return;

  const usadas = [...bloque.text.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]);
  const declaradas = (bloque.example?.body_text_named_params ?? []).map((p) => p.param_name);
  const faltan = usadas.filter((u) => !declaradas.includes(u));
  const sobran = declaradas.filter((d) => !usadas.includes(d));

  if (faltan.length || sobran.length) {
    throw new Error(
      `[${plantilla.clave}] variables descuadradas — sin ejemplo: [${faltan}]; de más: [${sobran}]`,
    );
  }
}

async function crear(plantilla) {
  const nombre = `${PREFIJO}_${plantilla.clave}`;
  const respuesta = await fetch(`${KAPSO_BASE}/${CUENTA}/message_templates`, {
    method: 'POST',
    headers: { 'X-API-Key': API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: nombre,
      language: IDIOMA,
      category: plantilla.categoria,
      parameter_format: plantilla.categoria === 'AUTHENTICATION' ? undefined : 'NAMED',
      components: plantilla.componentes,
    }),
  });

  const cuerpoRespuesta = await respuesta.json().catch(() => ({}));
  if (!respuesta.ok) {
    const detalle = cuerpoRespuesta?.error?.message ?? `HTTP ${respuesta.status}`;
    console.log(`  ✗ ${nombre}  ${detalle}`);
    return false;
  }
  console.log(`  ✓ ${nombre}  enviada a revisión de Meta`);
  return true;
}

async function ver(clave) {
  const nombre = `${PREFIJO}_${clave}`;
  const respuesta = await fetch(
    `${KAPSO_BASE}/${CUENTA}/message_templates?name=${encodeURIComponent(nombre)}`,
    { headers: { 'X-API-Key': API_KEY } },
  );
  const datos = await respuesta.json().catch(() => ({}));
  const encontrada = Array.isArray(datos?.data) ? datos.data.find((t) => t.name === nombre) : null;

  if (!encontrada) {
    console.log(`  · ${nombre}  no existe`);
    return;
  }
  const marca = encontrada.status === 'APPROVED' ? '✓' : encontrada.status === 'REJECTED' ? '✗' : '·';
  console.log(
    `  ${marca} ${nombre}  ${encontrada.status}${
      encontrada.rejected_reason ? `  (${encontrada.rejected_reason})` : ''
    }`,
  );
}

async function borrar(clave) {
  const nombre = `${PREFIJO}_${clave}`;
  const respuesta = await fetch(
    `${KAPSO_BASE}/${CUENTA}/message_templates?name=${encodeURIComponent(nombre)}`,
    { method: 'DELETE', headers: { 'X-API-Key': API_KEY } },
  );
  console.log(`  ${respuesta.ok ? '✓' : '✗'} ${nombre}  ${respuesta.ok ? 'borrada' : `HTTP ${respuesta.status}`}`);
}

async function main() {
  if (!API_KEY || !CUENTA) {
    console.error('Faltan KAPSO_API_KEY o KAPSO_BUSINESS_ACCOUNT_ID en el entorno.');
    process.exit(1);
  }

  const [comando, ...resto] = process.argv.slice(2);
  const conocidas = PLANTILLAS.map((p) => p.clave);
  const objetivo = resto.length > 0 ? resto : conocidas;

  // La cuenta de WhatsApp está compartida con otros proyectos: un borrado
  // suelto podría llevarse por delante una plantilla ajena.
  const desconocidas = objetivo.filter((c) => !conocidas.includes(c));
  if (desconocidas.length > 0) {
    console.error(`Plantillas fuera del catálogo: ${desconocidas.join(', ')}`);
    process.exit(1);
  }

  console.log(`\nPrefijo: ${PREFIJO}  ·  Idioma: ${IDIOMA}  ·  Dominio: ${URL_APP}\n`);

  if (comando === 'crear') {
    PLANTILLAS.forEach(validar);
    for (const plantilla of PLANTILLAS.filter((p) => objetivo.includes(p.clave))) {
      await crear(plantilla);
    }
    console.log('\nMeta puede tardar de minutos a días en aprobarlas. Revisa con "ver".\n');
    return;
  }

  if (comando === 'ver') {
    for (const clave of objetivo) await ver(clave);
    console.log('');
    return;
  }

  if (comando === 'borrar') {
    if (resto.length === 0) {
      console.error('Di qué plantilla borrar. No se borran todas de golpe a propósito.');
      process.exit(1);
    }
    for (const clave of resto) await borrar(clave);
    console.log('');
    return;
  }

  console.log('Comandos: crear | ver | borrar <clave>\n');
  console.log(`Catálogo: ${conocidas.join(', ')}\n`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
