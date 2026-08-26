import { type NextRequest, NextResponse } from 'next/server';

import { createServerClient } from '@supabase/ssr';

/**
 * Refresca la sesión en cada navegación. Sin esto, el token del vecino caduca
 * y al volver al día siguiente le vuelven a pedir el código de WhatsApp — que
 * es exactamente la fricción que el producto promete no tener.
 */
export async function middleware(request: NextRequest) {
  let respuesta = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          respuesta = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => respuesta.cookies.set(name, value, options));
        },
      },
    },
  );

  await supabase.auth.getUser();

  return respuesta;
}

export const config = {
  matcher: [
    // Todo menos estáticos e imágenes: no tiene sentido refrescar la sesión
    // para servir un ícono.
    '/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp|mp4)$).*)',
  ],
};
