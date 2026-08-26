import { cookies } from 'next/headers';

import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';

import type { Database } from '@/types/database.types';

/** Cliente del servidor, con la sesión del visitante leída de las cookies. */
export async function supabaseServidor() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {
            // Un Server Component no puede escribir cookies; el middleware ya
            // refrescó la sesión, así que aquí no hay nada que hacer.
          }
        },
      },
    },
  );
}

/**
 * Cliente con privilegios totales. Salta RLS, así que SOLO en el servidor y
 * nunca en respuesta directa a algo que escribió el visitante sin validar.
 * La clave no lleva prefijo NEXT_PUBLIC_ a propósito.
 */
export function supabaseAdmin() {
  const clave = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!clave) throw new Error('Falta SUPABASE_SERVICE_ROLE_KEY en el entorno del servidor');

  return createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, clave, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
