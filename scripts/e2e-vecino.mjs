// ============================================================================
// Recorrido completo de un vecino contra la API real, tal como lo haría el
// navegador: pedir el código, verificarlo, quedar registrado, apoyar una obra
// y comprobar que el contador subió.
//
// Es la prueba que las suites SQL no pueden dar: allí se suplanta al usuario
// con set_config, aquí se pasa de verdad por Supabase Auth y por las políticas
// de acceso con un token real.
//
// Correr con:  node --env-file=.env.local scripts/e2e-vecino.mjs
// Requiere el entorno local levantado (pnpm supabase start).
// ============================================================================

const URL_BASE = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://127.0.0.1:54321';
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const CIUDAD = process.env.NEXT_PUBLIC_CIUDAD_POR_DEFECTO ?? 'el-triunfo';

// Número y código fijos de [auth.sms.test_otp]. No gastan un WhatsApp real.
const TELEFONO = process.env.E2E_TELEFONO ?? '+593990000001';
const CODIGO = '123456';

let verdes = 0;
let rojos = 0;

function chk(nombre, ok, detalle = '') {
  if (ok) {
    verdes++;
    console.log(`  \x1b[32m✅ PASS\x1b[0m  ${nombre}${detalle ? `  \x1b[90m${detalle}\x1b[0m` : ''}`);
  } else {
    rojos++;
    console.log(`  \x1b[31m❌ FALLA\x1b[0m ${nombre}  \x1b[90m${detalle}\x1b[0m`);
  }
}

async function api(ruta, opciones = {}, token = null) {
  const respuesta = await fetch(`${URL_BASE}${ruta}`, {
    ...opciones,
    headers: {
      apikey: ANON,
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(opciones.headers ?? {}),
    },
  });
  const texto = await respuesta.text();
  let cuerpo;
  try {
    cuerpo = JSON.parse(texto);
  } catch {
    cuerpo = texto;
  }
  return { estado: respuesta.status, ok: respuesta.ok, cuerpo };
}

const rpc = (nombre, args, token) =>
  api(`/rest/v1/rpc/${nombre}`, { method: 'POST', body: JSON.stringify(args) }, token);

/**
 * Borra lo que dejó una corrida anterior de este mismo teléfono: los apoyos y
 * los pedidos de prueba. Sin esto, la segunda corrida del día choca con el
 * límite de tres pedidos diarios y el contador de apoyos ya no sube, y las
 * suites SQL heredan datos que no son suyos.
 *
 * Necesita la clave de servicio; si no está, se avisa y se sigue. La prueba
 * funciona igual la primera vez del día.
 */
async function limpiarCorridaAnterior() {
  const servicio = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!servicio) {
    console.log('  \x1b[90m(sin clave de servicio: no se limpian corridas anteriores)\x1b[0m\n');
    return;
  }

  const cabeceras = { apikey: servicio, Authorization: `Bearer ${servicio}` };

  const respuesta = await fetch(
    `${URL_BASE}/rest/v1/vecinos?telefono=eq.${encodeURIComponent(TELEFONO)}&select=id`,
    { headers: cabeceras },
  );
  const vecinos = await respuesta.json().catch(() => []);
  if (!Array.isArray(vecinos) || vecinos.length === 0) return;

  for (const { id } of vecinos) {
    await fetch(`${URL_BASE}/rest/v1/votos?vecino_id=eq.${id}`, {
      method: 'DELETE',
      headers: cabeceras,
    });
    await fetch(`${URL_BASE}/rest/v1/obras?creador_id=eq.${id}`, {
      method: 'DELETE',
      headers: cabeceras,
    });
    await fetch(`${URL_BASE}/rest/v1/vecinos?id=eq.${id}`, {
      method: 'DELETE',
      headers: cabeceras,
    });
  }
}

async function main() {
  if (!ANON) {
    console.error('Falta NEXT_PUBLIC_SUPABASE_ANON_KEY. Corre con: node --env-file=.env.local');
    process.exit(1);
  }

  console.log(`\nRecorrido del vecino — ${CIUDAD} — ${TELEFONO}\n`);

  await limpiarCorridaAnterior();

  // -- A. Mirar sin registrarse ---------------------------------------------
  const portada = await rpc('ciudad_portada', { p_ciudad_slug: CIUDAD });
  chk('A1 — la portada carga sin sesión', portada.ok && portada.cuerpo?.success === true);
  chk(
    'A2 — trae obras pre-cargadas para que la app no se vea vacía',
    (portada.cuerpo?.cifras?.obras ?? 0) > 0,
    `${portada.cuerpo?.cifras?.obras} obras`,
  );

  const listado = await rpc('obras_listar', { p_ciudad_slug: CIUDAD, p_limite: 5 });
  chk('A3 — un anónimo puede listar obras', listado.ok && listado.cuerpo?.success === true);

  const primera = listado.cuerpo?.items?.[0];
  chk('A4 — cada obra trae su código para compartir', primera?.codigo?.length === 6, primera?.codigo);

  const porCodigo = await rpc('obra_detalle', { p_codigo: primera?.codigo });
  chk(
    'A5 — el enlace corto abre la obra sin sesión',
    porCodigo.cuerpo?.success === true,
    porCodigo.cuerpo?.error_code ?? '',
  );

  // -- B. El OTP ------------------------------------------------------------
  const envio = await api('/auth/v1/otp', {
    method: 'POST',
    body: JSON.stringify({ phone: TELEFONO, channel: 'whatsapp', create_user: true }),
  });
  if (envio.estado === 429) {
    console.log('\n  \x1b[33m⚠  Límite de un código por minuto. Espera y vuelve a correr.\x1b[0m\n');
    process.exit(2);
  }
  chk('B1 — se puede pedir el código por WhatsApp', envio.ok, JSON.stringify(envio.cuerpo));

  const malo = await api('/auth/v1/verify', {
    method: 'POST',
    body: JSON.stringify({ phone: TELEFONO, token: '000000', type: 'sms' }),
  });
  chk('B2 — un código equivocado no da sesión', !malo.ok, `HTTP ${malo.estado}`);

  const verificado = await api('/auth/v1/verify', {
    method: 'POST',
    body: JSON.stringify({ phone: TELEFONO, token: CODIGO, type: 'sms' }),
  });
  chk('B3 — el código correcto abre sesión', verificado.ok, verificado.cuerpo?.error_description ?? '');

  const token = verificado.cuerpo?.access_token;
  if (!token) {
    console.log('\n\x1b[31mSin sesión no se puede seguir.\x1b[0m\n');
    process.exit(1);
  }

  // -- C. Alta del vecino ----------------------------------------------------
  const catalogoCiudadelas = await api(
    `/rest/v1/ciudadelas?ciudad_id=eq.${portada.cuerpo.ciudad.id}&slug=eq.arbolito-2&select=id,nombre`,
    {},
    token,
  );
  const arbolito2 = catalogoCiudadelas.cuerpo?.[0];
  chk('C1 — el catálogo de ciudadelas es legible', Boolean(arbolito2?.id), arbolito2?.nombre);

  const alta = await rpc(
    'vecino_asegurar',
    { p_ciudad_slug: CIUDAD, p_ciudadela_id: arbolito2.id, p_origen: 'compartido' },
    token,
  );
  chk('C2 — el vecino queda registrado', alta.cuerpo?.success === true, alta.cuerpo?.error_code ?? '');

  const repetida = await rpc('vecino_asegurar', { p_ciudad_slug: CIUDAD }, token);
  chk('C3 — registrarse dos veces no duplica nada', repetida.cuerpo?.success === true);

  // El padrón es el activo: ni con sesión se puede leer el de los demás.
  const padron = await api('/rest/v1/vecinos?select=telefono', {}, token);
  chk(
    'C4 — con sesión sigue sin poder leer teléfonos ajenos',
    Array.isArray(padron.cuerpo) && padron.cuerpo.length <= 1,
    `${Array.isArray(padron.cuerpo) ? padron.cuerpo.length : '?'} filas`,
  );

  // -- D. Apoyar -------------------------------------------------------------
  const deSuBarrio = await rpc('obras_listar', {
    p_ciudad_slug: CIUDAD,
    p_ciudadela_id: arbolito2.id,
    p_limite: 3,
  });
  const obra = deSuBarrio.cuerpo?.items?.[0];
  chk('D1 — hay obras de su propia ciudadela', Boolean(obra?.id), obra?.titulo);

  // Se retira cualquier apoyo previo para que el delta sea el de esta corrida
  // y no dependa de lo que hubiera antes en la base.
  await rpc('obra_quitar_apoyo', { p_obra_id: obra.id }, token);
  const estado = await rpc('obra_detalle', { p_obra_id: obra.id }, token);
  const antes = estado.cuerpo?.obra?.apoyos ?? 0;

  const apoyo = await rpc('obra_apoyar', { p_obra_id: obra.id }, token);
  chk('D2 — puede apoyar una obra de su barrio', apoyo.cuerpo?.success === true, apoyo.cuerpo?.error_code ?? '');
  chk('D3 — el contador sube en uno', apoyo.cuerpo?.apoyos === antes + 1, `${antes} → ${apoyo.cuerpo?.apoyos}`);

  const repetido = await rpc('obra_apoyar', { p_obra_id: obra.id }, token);
  chk('D4 — apoyar otra vez no cuenta doble', repetido.cuerpo?.apoyos === antes + 1, `${repetido.cuerpo?.apoyos}`);

  // La regla que sostiene el valor del dato territorial.
  const otras = await api(
    `/rest/v1/ciudadelas?ciudad_id=eq.${portada.cuerpo.ciudad.id}&slug=eq.arbolito-3&select=id`,
    {},
    token,
  );
  const ajena = await rpc('obras_listar', {
    p_ciudad_slug: CIUDAD,
    p_ciudadela_id: otras.cuerpo?.[0]?.id,
    p_limite: 1,
  });
  const obraAjena = ajena.cuerpo?.items?.[0];
  if (obraAjena) {
    const intento = await rpc('obra_apoyar', { p_obra_id: obraAjena.id }, token);
    chk(
      'D5 — NO puede apoyar una obra de otro barrio',
      intento.cuerpo?.error_code === 'fuera_de_tu_ciudadela',
      intento.cuerpo?.error_code ?? '',
    );
  }

  const conApoyo = await rpc('obra_detalle', { p_obra_id: obra.id }, token);
  chk('D6 — la obra le aparece como ya apoyada', conApoyo.cuerpo?.obra?.ya_apoyada === true);
  chk(
    'D7 — y trae el porcentaje de su ciudadela',
    typeof conApoyo.cuerpo?.obra?.porcentaje_ciudadela === 'number',
    `${conApoyo.cuerpo?.obra?.porcentaje_ciudadela}%`,
  );

  // -- E. Publicar un pedido -------------------------------------------------
  const categorias = await api(
    `/rest/v1/categorias?ciudad_id=eq.${portada.cuerpo.ciudad.id}&slug=eq.seguridad&select=id`,
    {},
    token,
  );
  const categoria = categorias.cuerpo?.[0]?.id;

  const similares = await rpc('obras_similares', {
    p_ciudadela_id: arbolito2.id,
    p_categoria_id: categoria,
  });
  chk('E1 — buscar antes de crear responde', similares.cuerpo?.success === true);

  const nuevo = await rpc(
    'obra_crear',
    {
      p_ciudadela_id: arbolito2.id,
      p_categoria_id: categoria,
      p_titulo: `Alarma comunitaria de prueba ${Date.now()}`,
      p_descripcion: 'Pedido creado por la prueba automática.',
    },
    token,
  );
  chk('E2 — puede publicar un pedido', nuevo.cuerpo?.success === true, nuevo.cuerpo?.error_code ?? '');
  chk('E3 — el pedido nace sin aprobar, para revisión', nuevo.cuerpo?.obra?.aprobada === false);

  const enPublico = await rpc('obras_listar', {
    p_ciudad_slug: CIUDAD,
    p_ciudadela_id: arbolito2.id,
    p_categoria_id: categoria,
  });
  chk(
    'E4 — no aparece en el listado público hasta que lo aprueben',
    !(enPublico.cuerpo?.items ?? []).some((o) => o.id === nuevo.cuerpo?.obra?.id),
  );

  // -- F. Lo que un vecino nunca debe poder ----------------------------------
  const tablero = await rpc('admin_tablero', { p_ciudad_id: portada.cuerpo.ciudad.id }, token);
  chk('F1 — un vecino NO ve el tablero del equipo', tablero.cuerpo?.error_code === 'sin_permiso');

  const ranking = await rpc('admin_ranking', { p_ciudad_id: portada.cuerpo.ciudad.id }, token);
  chk('F2 — un vecino NO ve el ranking del panel', ranking.cuerpo?.error_code === 'sin_permiso');

  const difusion = await rpc(
    'admin_difundir',
    { p_ciudad_id: portada.cuerpo.ciudad.id, p_mensaje: 'intento de un vecino cualquiera' },
    token,
  );
  chk('F3 — un vecino NO puede difundir por WhatsApp', difusion.cuerpo?.error_code === 'sin_permiso');

  const cola = await api('/rest/v1/notificaciones?select=telefono', {}, token);
  chk(
    'F4 — un vecino NO lee la cola de notificaciones',
    !Array.isArray(cola.cuerpo) || cola.cuerpo.length === 0,
  );

  // -- G. Darse de baja ------------------------------------------------------
  const baja = await rpc('vecino_darse_de_baja', {}, token);
  chk('G1 — puede darse de baja de los avisos', baja.cuerpo?.success === true);

  console.log(
    `\n${rojos === 0 ? '\x1b[32m' : '\x1b[31m'}Recorrido del vecino: ${verdes} en verde, ${rojos} en rojo\x1b[0m\n`,
  );
  process.exit(rojos === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error('\n\x1b[31mLa prueba se rompió:\x1b[0m', e);
  process.exit(1);
});
