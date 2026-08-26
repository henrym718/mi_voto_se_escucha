'use client';

import { createBrowserClient } from '@supabase/ssr';

import type { Database } from '@/types/database.types';

let cliente: ReturnType<typeof createBrowserClient<Database>> | null = null;

/** Cliente del navegador. Singleton: una sola conexión por pestaña. */
export function supabaseNavegador() {
  if (!cliente) {
    cliente = createBrowserClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );
  }
  return cliente;
}
