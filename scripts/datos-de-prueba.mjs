// ============================================================================
// Datos de demostración para un ambiente de prueba.
//
// POR QUÉ ES UN SCRIPT Y NO PARTE DEL SEED
//
// `supabase/seed.sql` lo aplica CUALQUIER reset, incluido el de producción en
// modo prelanzamiento. Lo que hay ahí tiene que poder mirarse el día del
// lanzamiento sin sonrojarse: las ciudadelas del PDOT y las 49 carencias
// documentadas, con su fuente citada y cero apoyos.
//
// Esto de aquí es otra cosa: vecinos inventados, apoyos inventados y fotos de
// relleno. Sirve para VER la aplicación llena —el tablero con columnas, el
// ranking con porcentajes, la cola con pedidos que revisar, la línea de tiempo
// con fotos— y no puede filtrarse jamás a producción. Por eso vive fuera del
// seed y solo lo llama el pipeline de staging, con una llamada explícita que
// se lee en el archivo del workflow.
//
// COHERENCIA
//
// Los números no son ruido: las obras más apoyadas son las que avanzan de
// estado, los apoyos vienen sobre todo de vecinos del propio sector (que es lo
// que hace que el porcentaje del ranking signifique algo), y los sectores con
// más población concentran más gente. Quien abra el panel encuentra la misma
// historia que cuenta la parte pública.
//
// FOTOS
//
// Salen de Lorem Picsum (picsum.photos), que no pide clave ni registro, y se
// SUBEN a los buckets del propio proyecto en vez de enlazarse. Así el ambiente
// no depende de que un servicio de terceros siga en pie dentro de seis meses,
// y de paso el despliegue prueba que el almacenamiento quedó bien configurado.
// Si la descarga falla, el dato entra sin foto y el script sigue: un ambiente
// de prueba sin fotos es un contratiempo, un pipeline en rojo es un problema.
//
// LO QUE ESTE SCRIPT NO INVENTA
//
// Los enlaces de canal de WhatsApp. Un canal se crea a mano una vez y el
// equipo pega su enlace desde el panel; uno sembrado abriría un error de
// WhatsApp en la cara del vecino justo después de apoyar, que es peor que un
// campo vacío. La suite smoke-territorio lo comprueba (C5). La pantalla de
// Canales igual queda llena de contenido: los ciento veinte vecinos traen
// teléfono, y ahí se ve cuántos contactos y cuántos esperan canal por sector,
// que es para lo que sirve esa pantalla.
//
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/datos-de-prueba.mjs
//
// Opciones por entorno:
//   CIUDAD=el-triunfo     ciudad sobre la que se siembra
//   DATOS_SIN_FOTOS=1     no descarga ni sube nada; todo entra sin imagen
//   --forzar              salta la comprobación de base vacía (ver abajo)
// ============================================================================

const URL_BASE = process.env.SUPABASE_URL;
const CLAVE_SERVICIO = process.env.SUPABASE_SERVICE_ROLE_KEY;
const CIUDAD = process.env.CIUDAD ?? 'el-triunfo';
const SIN_FOTOS = process.env.DATOS_SIN_FOTOS === '1';
const FORZAR = process.argv.includes('--forzar');

if (!URL_BASE || !CLAVE_SERVICIO) {
  console.error('Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY.');
  process.exit(1);
}

const cabeceras = {
  apikey: CLAVE_SERVICIO,
  Authorization: `Bearer ${CLAVE_SERVICIO}`,
  'Content-Type': 'application/json',
};

/* ----------------------------------------------------------------- HTTP -- */

async function api(ruta, opciones = {}) {
  const respuesta = await fetch(`${URL_BASE}${ruta}`, {
    ...opciones,
    headers: { ...cabeceras, ...(opciones.headers ?? {}) },
  });
  const texto = await respuesta.text();
  if (!respuesta.ok) throw new Error(`${ruta} → HTTP ${respuesta.status} ${texto.slice(0, 400)}`);
  return texto ? JSON.parse(texto) : null;
}

const leer = (tabla, consulta) => api(`/rest/v1/${tabla}?${consulta}`);

/** Inserta en lotes. PostgREST acepta arrays, pero un lote de miles de filas
 *  se come el tiempo de espera del proxy; de 500 en 500 no se ha caído nunca. */
async function insertar(tabla, filas, { devolver = false } = {}) {
  const resultados = [];
  for (let i = 0; i < filas.length; i += 500) {
    const trozo = filas.slice(i, i + 500);
    const r = await api(`/rest/v1/${tabla}`, {
      method: 'POST',
      headers: devolver ? { Prefer: 'return=representation' } : {},
      body: JSON.stringify(trozo),
    });
    if (devolver && Array.isArray(r)) resultados.push(...r);
  }
  return resultados;
}

const actualizar = (tabla, consulta, cambios) =>
  api(`/rest/v1/${tabla}?${consulta}`, { method: 'PATCH', body: JSON.stringify(cambios) });

/** Ejecuta `tarea` sobre cada elemento con un tope de tareas en vuelo. Crear
 *  ciento veinte usuarios de uno en uno son ciento veinte viajes de ida y
 *  vuelta; de ocho en ocho, el paso baja de minutos a segundos. */
async function enParalelo(items, tope, tarea) {
  const salida = new Array(items.length);
  let siguiente = 0;
  await Promise.all(
    Array.from({ length: Math.min(tope, items.length) }, async () => {
      while (siguiente < items.length) {
        const i = siguiente++;
        salida[i] = await tarea(items[i], i);
      }
    }),
  );
  return salida;
}

/* ------------------------------------------------------------ aleatorio -- */

// Determinista a propósito: el mismo despliegue tiene que dejar el mismo
// ambiente. Si el ranking cambiara de orden en cada corrida, nadie podría
// decir "mira la tercera fila" en una demo.
let semilla = 20260827;
function azar() {
  semilla |= 0;
  semilla = (semilla + 0x6d2b79f5) | 0;
  let t = Math.imul(semilla ^ (semilla >>> 15), 1 | semilla);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const entero = (min, max) => min + Math.floor(azar() * (max - min + 1));
const alguno = (lista) => lista[Math.floor(azar() * lista.length)];

/* ---------------------------------------------------------------- fotos -- */

const BUCKET_PUBLICO = (bucket, ruta) => `${URL_BASE}/storage/v1/object/public/${bucket}/${ruta}`;

let fotosFallidas = 0;

/**
 * Trae una imagen y la deja en un bucket del proyecto. Devuelve la url pública
 * o null si algo falló — nunca lanza: ninguna foto de relleno vale un pipeline
 * en rojo.
 */
async function subirFoto(bucket, ruta, origen) {
  if (SIN_FOTOS) return null;
  try {
    const descarga = await fetch(origen, { redirect: 'follow' });
    if (!descarga.ok) throw new Error(`HTTP ${descarga.status}`);
    const cuerpo = Buffer.from(await descarga.arrayBuffer());

    const subida = await fetch(`${URL_BASE}/storage/v1/object/${bucket}/${ruta}`, {
      method: 'POST',
      headers: {
        apikey: CLAVE_SERVICIO,
        Authorization: `Bearer ${CLAVE_SERVICIO}`,
        'Content-Type': 'image/jpeg',
        'x-upsert': 'true',
      },
      body: cuerpo,
    });
    if (!subida.ok) throw new Error(`subida HTTP ${subida.status} ${await subida.text()}`);

    return BUCKET_PUBLICO(bucket, ruta);
  } catch (e) {
    fotosFallidas += 1;
    console.warn(`  · sin foto (${ruta}): ${e.message}`);
    return null;
  }
}

// `seed` fija la foto: la misma semilla devuelve siempre la misma imagen, y el
// ambiente no cambia de cara en cada despliegue.
const PICSUM = (nombre, w, h) => `https://picsum.photos/seed/mvse-${nombre}/${w}/${h}`;
const RETRATO = (nombre) => `https://i.pravatar.cc/400?u=mvse-${nombre}`;

/* ---------------------------------------------------------------- datos -- */

// El video de presentación va solo en dos fichas y no en las cinco: así se ve
// en la demo tanto la ficha con botón de play como la que no lo tiene, que es
// como va a quedar un equipo de verdad. Son videos públicos y neutros —de
// dominio público en el Internet Archive— porque en un ambiente de prueba no
// se puede incrustar el video de nadie sin permiso.
const VIDEO_DEMO = 'https://www.youtube.com/watch?v=aqz-KE-bpKQ';

const EQUIPO = [
  {
    slug: 'ramon-peralta',
    nombre: 'Ramón Peralta',
    cargo: 'Candidato a la Alcaldía de El Triunfo',
    bio: 'Ficha de demostración. Aquí va quién es el candidato, a qué se ha dedicado y por qué se presenta. Todo este ambiente contiene datos inventados.',
    es_candidato: true,
    video_url: VIDEO_DEMO,
  },
  {
    slug: 'doris-chalen',
    nombre: 'Doris Chalén',
    cargo: 'Coordinadora de barrios',
    bio: 'Ficha de demostración. Recorre los sectores, levanta los pedidos que llegan en asamblea y los sube al sistema.',
    es_candidato: false,
    video_url: VIDEO_DEMO,
  },
  {
    slug: 'wilmer-aguayo',
    nombre: 'Wilmer Aguayo',
    cargo: 'Jefe de territorio',
    bio: 'Ficha de demostración. Arma las brigadas y organiza los recorridos por ciudadela.',
    es_candidato: false,
  },
  {
    slug: 'jessenia-mora',
    nombre: 'Jessenia Mora',
    cargo: 'Comunicación',
    bio: 'Ficha de demostración. Publica los avances y mantiene los canales de WhatsApp de cada sector.',
    es_candidato: false,
  },
  {
    slug: 'edgar-bajana',
    nombre: 'Édgar Bajaña',
    cargo: 'Candidato a concejal',
    bio: 'Ficha de demostración. Acompaña las visitas técnicas y da seguimiento a los compromisos.',
    es_candidato: false,
  },
];

// Lo que un vecino escribe de verdad: sin mayúscula inicial, sin punto final y
// contando el problema por dónde le duele. El ayudante de IA es justo lo que
// convierte esto en el título y la descripción de al lado.
const PEDIDOS_EN_COLA = [
  {
    texto:
      'en la calle 9 el agua se queda estancada como tres días después de que llueve, ya hay zancudos y los niños pasan por ahí para ir a la escuela',
    titulo: 'Agua estancada en la calle 9 tras cada lluvia',
    descripcion:
      'Después de cada lluvia el agua se queda estancada varios días en la calle 9. Se llena de zancudos y es el paso de los niños hacia la escuela.',
    categoria: 'pluvial',
    ia_estado: 'listo',
    foto: true,
  },
  {
    texto:
      'no hay alumbrado desde la esquina de la cancha hasta la escuela, ya van dos robos este mes en ese tramo',
    titulo: 'Sin alumbrado entre la cancha y la escuela',
    descripcion:
      'El tramo entre la cancha y la escuela quedó a oscuras. Los vecinos reportan dos robos este mes en ese mismo tramo.',
    categoria: 'alumbrado',
    ia_estado: 'listo',
    foto: true,
  },
  {
    texto: 'la tapa del alcantarillado de la esquina está rota hace meses, un moto ya se cayó ahí',
    titulo: 'Tapa de alcantarillado rota en la esquina',
    descripcion:
      'La tapa lleva meses rota y el hueco quedó abierto en plena esquina. Ya hubo una caída de una moto.',
    categoria: 'sanitario',
    ia_estado: 'listo',
    foto: true,
  },
  {
    texto:
      'el carro recolector no entra a la calle desde que se dañó el puente, la basura se acumula en la esquina',
    titulo: 'La basura se acumula desde que el recolector no entra',
    descripcion:
      'El recolector dejó de entrar por el puente dañado y la basura se junta en la esquina de la entrada.',
    categoria: 'basura',
    ia_estado: 'listo',
    foto: false,
  },
  {
    texto:
      'necesitamos que arreglen la cancha, los muchachos juegan igual pero el piso está partido y ya alguien se lastimó',
    titulo: 'La cancha del sector está partida',
    descripcion:
      'El piso de la cancha está partido. Los muchachos siguen jugando y ya hubo un lesionado.',
    categoria: 'parques',
    ia_estado: 'listo',
    foto: true,
  },
  {
    texto:
      'aquí el agua llega turbia dos o tres veces por semana, tenemos que comprar botellón para cocinar',
    titulo: 'El agua llega turbia varias veces por semana',
    descripcion:
      'El agua llega turbia dos o tres veces por semana. Las familias del sector compran botellón para cocinar.',
    categoria: 'agua',
    ia_estado: 'listo',
    foto: false,
  },
  // Sin título: la IA no pudo ordenarlo y el equipo tiene que redactarlo a
  // mano. Es el caso que hay que poder ver en la cola sin buscarlo.
  {
    texto:
      'buenas tardes vecinos aquí en la entrada hay un problema con lo que les comenté el otro día, por favor ayuda',
    titulo: null,
    descripcion: '',
    categoria: 'aceras',
    ia_estado: 'fallido',
    foto: false,
  },
  {
    texto:
      'las aceras de toda la cuadra están rotas y mi mamá usa andador, tiene que bajarse a la calle para pasar',
    titulo: null,
    descripcion: '',
    categoria: 'aceras',
    ia_estado: 'pendiente',
    foto: false,
  },
  {
    texto:
      'la vía de tierra se vuelve intransitable en invierno, ni las motos pasan y los camiones del arroz menos',
    titulo: 'La vía de tierra se vuelve intransitable en invierno',
    descripcion:
      'En invierno la vía de tierra no la pasa ni una moto. Los camiones que sacan el arroz tampoco entran.',
    categoria: 'rural',
    ia_estado: 'listo',
    foto: true,
  },
];

const PEDIDOS_DEL_EQUIPO = [
  {
    titulo: 'Bordillos y aceras en el tramo de la escuela',
    descripcion:
      'Levantado en la asamblea del sector: piden bordillos y acera en el tramo por el que los niños entran a la escuela.',
    categoria: 'aceras',
    fuente: 'Asamblea de barrio del 14 de marzo',
  },
  {
    titulo: 'Iluminación del parque central del sector',
    descripcion:
      'Pedido recogido en el recorrido de territorio. El parque queda sin luz desde las siete y deja de usarse.',
    categoria: 'alumbrado',
    fuente: 'Recorrido de territorio, 22 de marzo',
  },
  {
    titulo: 'Rejilla de aguas lluvia en la entrada del sector',
    descripcion:
      'La entrada se anega en cada aguacero porque no hay rejilla. Lo levantaron los vecinos por teléfono.',
    categoria: 'pluvial',
    fuente: 'Llamada de la directiva del sector',
  },
];

// Qué se le dice al vecino en cada estado. El texto va al mismo sitio que verá
// en la línea de tiempo pública de su obra, así que se escribe como se
// escribiría de verdad.
const AVANCES = {
  revision: 'Recibimos el pedido y lo estamos revisando con los vecinos del sector.',
  visitada:
    'Estuvimos en el sitio con el equipo técnico. Medimos el tramo y tomamos las fotos del punto donde se acumula el agua.',
  comprometida:
    'Queda como compromiso público: esta obra entra en el plan del primer año. Lo dijimos delante de los vecinos del sector.',
  'estudio-tecnico':
    'Pasa a estudio técnico. Antes de poder presupuestarla hace falta el levantamiento topográfico del tramo.',
  'mediano-plazo':
    'Queda proyectada a mediano plazo: depende de la ampliación de la red matriz, que es obra previa.',
};

/* ----------------------------------------------------------------- main -- */

async function main() {
  const [ciudad] = await leer('ciudades', `slug=eq.${CIUDAD}&select=id,nombre`);
  if (!ciudad) throw new Error(`La ciudad "${CIUDAD}" no existe. ¿Corrió el seed?`);

  // Guardia. Este script solo tiene sentido sobre una base recién reconstruida:
  // si ya hay vecinos, o son de otra corrida (y esto duplicaría todo) o son
  // REALES, y entonces lo último que se quiere es echarles apoyos inventados
  // encima. Se para y se explica, en vez de adivinar.
  const vecinosPrevios = await api(`/rest/v1/vecinos?ciudad_id=eq.${ciudad.id}&select=id&limit=1`, {
    headers: { Prefer: 'count=exact' },
  });
  if (vecinosPrevios.length > 0 && !FORZAR) {
    console.error(
      `La base de ${ciudad.nombre} ya tiene vecinos.\n` +
        'Este script se corre sobre una base recién reseteada. Resetéala primero\n' +
        '(supabase db reset) o pasa --forzar si de verdad quieres añadir encima.',
    );
    // exitCode y no process.exit(): cortar el proceso con una conexión de fetch
    // todavía viva revienta libuv en Windows con un fallo de aserción, y el
    // pipeline recibiría un 127 en vez del 1 que quiere decir "me planté".
    process.exitCode = 1;
    return;
  }

  console.log(`Sembrando datos de prueba en ${ciudad.nombre}${SIN_FOTOS ? ' (sin fotos)' : ''}…`);

  const ciudadelas = await leer(
    'ciudadelas',
    `ciudad_id=eq.${ciudad.id}&activa=eq.true&select=id,nombre,slug,poblacion_estimada&order=orden`,
  );
  const categorias = await leer(
    'categorias',
    `ciudad_id=eq.${ciudad.id}&activa=eq.true&select=id,slug,nombre&order=orden`,
  );
  const estados = await leer(
    'estados',
    `ciudad_id=eq.${ciudad.id}&activo=eq.true&select=id,slug,nombre&order=orden`,
  );
  const porSlug = (lista) => Object.fromEntries(lista.map((x) => [x.slug, x.id]));
  const estadoDe = porSlug(estados);
  const categoriaDe = porSlug(categorias);
  const estadoInicial = estados[0].id;

  // El autor de los avances. Si el pipeline aún no creó la cuenta del equipo,
  // las publicaciones entran sin firmar antes que romperse.
  const [admin] = await leer('admins', `ciudad_id=eq.${ciudad.id}&select=id&limit=1`);
  const autor = admin?.id ?? null;

  /* ------------------------------------------------------------ portal -- */

  const fotoCandidato = await subirFoto(
    'portal',
    `${ciudad.id}/demo-candidato.jpg`,
    RETRATO('candidato'),
  );
  const banner = await subirFoto(
    'portal',
    `${ciudad.id}/demo-banner.jpg`,
    PICSUM('banner', 1600, 600),
  );

  await actualizar('portal', `ciudad_id=eq.${ciudad.id}`, {
    candidato_nombre: 'Ramón Peralta',
    candidato_cargo: 'Candidato a la Alcaldía de El Triunfo',
    partido: 'Movimiento Fuerza del Cantón',
    cedula: '0912345678',
    eslogan: 'El Triunfo lo decidimos entre todos',
    hero_subtitulo:
      'Pide la obra que le hace falta a tu barrio y apoya las de tus vecinos. Las más apoyadas entran al plan de obras.',
    bio: 'Ambiente de demostración: el candidato, el equipo y los apoyos de esta página son inventados. Sirve para ver cómo se comporta la plataforma con datos dentro.',
    ...(fotoCandidato ? { foto_url: fotoCandidato } : {}),
    ...(banner ? { banner_url: banner } : {}),
  });

  /* ----------------------------------------------------------- equipo -- */

  const retratos = await enParalelo(EQUIPO, 4, (p) =>
    subirFoto('portal', `${ciudad.id}/demo-${p.slug}.jpg`, RETRATO(p.slug)),
  );

  // El seed deja una ficha de marcador de posición; se va, porque estas la
  // reemplazan y dos candidatos a la vez rompen el índice de es_candidato.
  await api(`/rest/v1/perfiles?ciudad_id=eq.${ciudad.id}`, { method: 'DELETE' });
  await insertar(
    'perfiles',
    EQUIPO.map((p, i) => ({
      ciudad_id: ciudad.id,
      slug: p.slug,
      nombre: p.nombre,
      cargo: p.cargo,
      bio: p.bio,
      foto_url: retratos[i],
      es_candidato: p.es_candidato,
      telefono: `+5939${entero(10, 99)}${entero(100000, 999999)}`,
      correo: `${p.slug}@ejemplo.test`,
      redes: { facebook: `https://facebook.com/${p.slug}` },
      video_url: p.video_url ?? null,
      orden: i,
    })),
  );

  /* ---------------------------------------------------------- vecinos -- */

  // Reparto por población: un sector grande concentra más gente que una
  // lotización de veinte casas, y el porcentaje del ranking solo dice algo si
  // el denominador se parece a la realidad.
  const pesos = ciudadelas.map((cd) => cd.poblacion_estimada ?? 400);
  const total = pesos.reduce((a, b) => a + b, 0);
  const sorteaSector = () => {
    let n = azar() * total;
    for (let i = 0; i < ciudadelas.length; i++) {
      n -= pesos[i];
      if (n <= 0) return ciudadelas[i];
    }
    return ciudadelas[ciudadelas.length - 1];
  };

  const CUANTOS = 120;
  console.log(`  · creando ${CUANTOS} vecinos…`);

  const cuentas = await enParalelo(
    Array.from({ length: CUANTOS }, (_, i) => i),
    8,
    async (i) => {
      // Un vecino real entra con sesión anónima; aquí llevan correo `.test`
      // (dominio reservado, jamás enrutable) porque el alta administrativa lo
      // pide y porque así se distingue de un vistazo lo sembrado de lo real.
      const usuario = await api('/auth/v1/admin/users', {
        method: 'POST',
        body: JSON.stringify({
          email: `vecino-${String(i + 1).padStart(3, '0')}@demo.mivotoseescucha.test`,
          password: `demo-${i}-${ciudad.id.slice(0, 8)}`,
          email_confirm: true,
        }),
      });
      return usuario.id;
    },
  );

  const vecinos = cuentas.map((id) => {
    const sector = sorteaSector();
    return {
      id,
      ciudad_id: ciudad.id,
      ciudadela_id: sector.id,
      telefono: `+5939${entero(10, 99)}${entero(100000, 999999)}`,
      quiere_canal: azar() < 0.55,
      origen: alguno(['directo', 'directo', 'qr', 'compartido']),
    };
  });
  await insertar('vecinos', vecinos);

  /* ------------------------------------------------- pedidos de vecinos -- */

  console.log('  · levantando pedidos en la cola…');

  const fotosCola = await enParalelo(PEDIDOS_EN_COLA, 4, (p, i) =>
    p.foto ? subirFoto('obras', `demo/cola-${i}.jpg`, PICSUM(`cola-${i}`, 1200, 900)) : null,
  );

  await insertar(
    'obras',
    PEDIDOS_EN_COLA.map((p, i) => {
      const autorVecino = vecinos[entero(0, vecinos.length - 1)];
      return {
        ciudad_id: ciudad.id,
        // El sector es el del vecino que lo escribió, y la categoría la que le
        // corresponde al problema. Sorteadas quedaban cosas como una tapa de
        // alcantarillado rota clasificada en «Recolección de basura», que es
        // justo lo que hace que una demo pierda credibilidad en dos segundos.
        ciudadela_id: autorVecino.ciudadela_id,
        categoria_id: categoriaDe[p.categoria],
        estado_id: estadoInicial,
        titulo: p.titulo,
        descripcion: p.descripcion,
        texto_original: p.texto,
        ia_estado: p.ia_estado,
        foto_url: fotosCola[i],
        origen: 'vecino',
        creador_id: autorVecino.id,
        aprobada: false,
      };
    }),
  );

  /* -------------------------------------------------- pedidos del equipo -- */

  const fotosEquipo = await enParalelo(PEDIDOS_DEL_EQUIPO, 3, (p, i) =>
    subirFoto('obras', `demo/equipo-${i}.jpg`, PICSUM(`equipo-${i}`, 1200, 900)),
  );

  await insertar(
    'obras',
    PEDIDOS_DEL_EQUIPO.map((p, i) => ({
      ciudad_id: ciudad.id,
      ciudadela_id: alguno(ciudadelas).id,
      categoria_id: categoriaDe[p.categoria],
      estado_id: estadoInicial,
      titulo: p.titulo,
      descripcion: p.descripcion,
      foto_url: fotosEquipo[i],
      origen: 'equipo',
      fuente: p.fuente,
      aprobada: true,
      aprobada_en: new Date().toISOString(),
      aprobada_por: autor,
    })),
  );

  /* -------------------------------------------------- fotos de las obras -- */

  // Las 49 obras del PDOT entran por el seed sin foto —nadie las fotografió,
  // salieron de un documento— y en la lista se veían todas con el cuadrado gris
  // del puesto. Aquí se les pone una para que el listado se parezca al que va a
  // haber cuando la gente publique.
  //
  // No a todas: una de cada siete se queda sin foto a propósito. Un vecino
  // escribiendo desde el celular a veces manda solo texto, y el diseño de la
  // tarjeta sin foto tiene que verse en la demo igual que se va a ver en
  // producción.
  const sinFoto = await leer(
    'obras',
    `ciudad_id=eq.${ciudad.id}&foto_url=is.null&rechazada_en=is.null&select=id&order=creada_en`,
  );
  const aFotografiar = sinFoto.filter((_, i) => i % 7 !== 3);
  console.log(`  · poniendo foto a ${aFotografiar.length} de ${sinFoto.length} obras…`);

  await enParalelo(aFotografiar, 5, async (obra, i) => {
    const url = await subirFoto('obras', `demo/obra-${i}.jpg`, PICSUM(`obra-${i}`, 1200, 900));
    if (url) await actualizar('obras', `id=eq.${obra.id}`, { foto_url: url });
  });

  /* ------------------------------------------------------------ apoyos -- */

  console.log('  · repartiendo apoyos…');

  const publicadas = await leer(
    'obras',
    `ciudad_id=eq.${ciudad.id}&aprobada=eq.true&select=id,ciudadela_id,categoria_id`,
  );
  const porSector = new Map();
  for (const o of publicadas) {
    if (!porSector.has(o.ciudadela_id)) porSector.set(o.ciudadela_id, []);
    porSector.get(o.ciudadela_id).push(o);
  }

  const votos = [];
  const yaVotado = new Set();
  for (const vecino of vecinos) {
    const suyas = porSector.get(vecino.ciudadela_id) ?? [];
    for (let n = entero(1, 9); n > 0; n--) {
      // Siete de cada diez apoyos son del propio barrio. Es lo que hace que el
      // porcentaje del ranking —que solo cuenta a los del sector— sea una
      // señal y no un eco del total.
      const obra = azar() < 0.7 && suyas.length > 0 ? alguno(suyas) : alguno(publicadas);
      const llave = `${obra.id}:${vecino.id}`;
      if (yaVotado.has(llave)) continue;
      yaVotado.add(llave);
      votos.push({ obra_id: obra.id, vecino_id: vecino.id, ciudad_id: ciudad.id });
    }
  }
  await insertar('votos', votos);

  /* ------------------------------------------------------------ avances -- */

  // Avanzan las más apoyadas, que es la promesa entera del producto: lo que el
  // barrio respalda es lo que entra al plan. Si aquí avanzaran obras al azar,
  // el panel contaría una historia distinta de la que cuenta la portada.
  console.log('  · moviendo las más apoyadas por el tablero…');

  const ranking = await leer(
    'obras',
    `ciudad_id=eq.${ciudad.id}&aprobada=eq.true&select=id,titulo,estado_id&order=apoyos.desc&limit=16`,
  );

  const RECORRIDO = [
    'comprometida',
    'visitada',
    'comprometida',
    'visitada',
    'estudio-tecnico',
    'comprometida',
    'revision',
    'visitada',
    'mediano-plazo',
    'revision',
    'comprometida',
    'estudio-tecnico',
    'visitada',
    'revision',
    'mediano-plazo',
    'revision',
  ];

  const publicaciones = [];
  for (let i = 0; i < ranking.length; i++) {
    const obra = ranking[i];
    const destino = RECORRIDO[i];
    const anterior = obra.estado_id;

    await actualizar('obras', `id=eq.${obra.id}`, { estado_id: estadoDe[destino] });

    // Foto solo en los estados en los que de verdad habría una: nadie saca una
    // foto de "en revisión". En visitada y comprometida sí — es el candidato
    // parado en el sitio, que es la mitad del valor de la línea de tiempo.
    const conFoto = destino === 'visitada' || destino === 'comprometida';
    const foto = conFoto
      ? await subirFoto(
          'publicaciones',
          `${ciudad.id}/demo-avance-${i}.jpg`,
          PICSUM(`avance-${i}`, 1400, 1000),
        )
      : null;

    publicaciones.push({
      ciudad_id: ciudad.id,
      obra_id: obra.id,
      estado_id: estadoDe[destino],
      estado_anterior_id: anterior,
      texto: AVANCES[destino],
      media: foto ? [{ tipo: 'foto', url: foto }] : [],
      autor_id: autor,
    });
  }
  await insertar('publicaciones', publicaciones);

  /* ------------------------------------------------------- lo descartado -- */

  // Un histórico sin nada rechazado no se parece a ningún cantón. Dos pedidos
  // fuera: uno repetido y uno que no es competencia municipal.
  const [rechazable] = await leer(
    'obras',
    `ciudad_id=eq.${ciudad.id}&origen=eq.vecino&aprobada=eq.false&select=id&limit=1&offset=5`,
  );
  if (rechazable) {
    await actualizar('obras', `id=eq.${rechazable.id}`, {
      rechazada_en: new Date().toISOString(),
      motivo_rechazo:
        'Ya estaba pedido por otro vecino del mismo sector. Se sumó al pedido original.',
    });
  }

  /* ------------------------------------------------------------ resumen -- */

  const cuenta = async (tabla, consulta) => {
    const r = await fetch(`${URL_BASE}/rest/v1/${tabla}?${consulta}&select=id`, {
      headers: { ...cabeceras, Prefer: 'count=exact', Range: '0-0' },
    });
    return r.headers.get('content-range')?.split('/')[1] ?? '?';
  };

  console.log('');
  console.log(`Listo. ${ciudad.nombre} quedó con:`);
  console.log(`  vecinos       ${await cuenta('vecinos', `ciudad_id=eq.${ciudad.id}`)}`);
  console.log(`  apoyos        ${votos.length}`);
  console.log(`  obras         ${await cuenta('obras', `ciudad_id=eq.${ciudad.id}`)}`);
  console.log(
    `  con foto      ${await cuenta('obras', `ciudad_id=eq.${ciudad.id}&foto_url=not.is.null`)}`,
  );
  console.log(
    `  en la cola    ${await cuenta('obras', `ciudad_id=eq.${ciudad.id}&aprobada=eq.false&rechazada_en=is.null`)}`,
  );
  console.log(`  avances       ${publicaciones.length}`);
  console.log(`  fichas equipo ${EQUIPO.length}`);
  if (fotosFallidas > 0) {
    console.log('');
    console.log(
      `Aviso: ${fotosFallidas} imágenes no se pudieron subir; esos registros van sin foto.`,
    );
  }
}

main().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
