// ============================================================================
// Crea (o repara) la cuenta de administrador del equipo en un ambiente de la
// nube. Lo llama el pipeline al final del despliegue.
//
// Es idempotente: si la cuenta ya existe, actualiza la clave y se asegura de
// que tenga rol de admin en la ciudad. Correrlo dos veces no rompe nada.
//
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
//   ADMIN_CORREO=... ADMIN_CLAVE=... node scripts/crear-cuenta-equipo.mjs
// ============================================================================

const URL_BASE = process.env.SUPABASE_URL;
const CLAVE_SERVICIO = process.env.SUPABASE_SERVICE_ROLE_KEY;
const CORREO = process.env.ADMIN_CORREO;
const CLAVE = process.env.ADMIN_CLAVE;
const CIUDAD = process.env.ADMIN_CIUDAD ?? 'el-triunfo';

if (!URL_BASE || !CLAVE_SERVICIO || !CORREO || !CLAVE) {
  console.error('Faltan SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ADMIN_CORREO o ADMIN_CLAVE.');
  process.exit(1);
}

const cabeceras = {
  apikey: CLAVE_SERVICIO,
  Authorization: `Bearer ${CLAVE_SERVICIO}`,
  'Content-Type': 'application/json',
};

async function json(ruta, opciones = {}) {
  const respuesta = await fetch(`${URL_BASE}${ruta}`, { ...opciones, headers: cabeceras });
  const texto = await respuesta.text();
  if (!respuesta.ok) throw new Error(`${ruta} → HTTP ${respuesta.status} ${texto}`);
  return texto ? JSON.parse(texto) : null;
}

async function main() {
  const ciudades = await json(`/rest/v1/ciudades?slug=eq.${CIUDAD}&select=id,nombre`);
  const ciudad = ciudades?.[0];
  if (!ciudad) throw new Error(`La ciudad "${CIUDAD}" no existe. ¿Corrió el seed?`);

  // Buscar si ya existe.
  const existentes = await json(
    `/auth/v1/admin/users?filter=${encodeURIComponent(CORREO)}&per_page=1`,
  );
  let usuario = existentes?.users?.find((u) => u.email === CORREO);

  if (usuario) {
    await json(`/auth/v1/admin/users/${usuario.id}`, {
      method: 'PUT',
      body: JSON.stringify({ password: CLAVE, email_confirm: true }),
    });
    console.log(`Cuenta existente actualizada: ${CORREO}`);
  } else {
    usuario = await json('/auth/v1/admin/users', {
      method: 'POST',
      body: JSON.stringify({ email: CORREO, password: CLAVE, email_confirm: true }),
    });
    console.log(`Cuenta creada: ${CORREO}`);
  }

  // Asegurar el rol en la ciudad.
  await fetch(`${URL_BASE}/rest/v1/admins`, {
    method: 'POST',
    headers: { ...cabeceras, Prefer: 'resolution=merge-duplicates' },
    body: JSON.stringify({
      id: usuario.id,
      ciudad_id: ciudad.id,
      rol: 'admin',
      nombre: 'Administrador',
      activo: true,
    }),
  });

  console.log(`Rol de admin asegurado en ${ciudad.nombre}.`);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
