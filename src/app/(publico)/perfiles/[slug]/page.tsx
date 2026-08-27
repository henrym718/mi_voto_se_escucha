import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { type Perfil, PerfilView } from '@/modules/portada/views/perfil.view';
import { ciudadActual } from '@/shared/config/ciudad';
import { supabaseServidor } from '@/shared/lib/supabase/server';

async function traerPerfil(slugPerfil: string): Promise<Perfil | null> {
  const slug = await ciudadActual();
  const supabase = await supabaseServidor();

  const { data } = await supabase.rpc('portal_perfil', {
    p_ciudad_slug: slug,
    p_slug: slugPerfil,
  });

  const respuesta = data as unknown as { success: boolean; perfil?: Perfil } | null;
  return respuesta?.success ? (respuesta.perfil ?? null) : null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const perfil = await traerPerfil(slug);
  if (!perfil) return { title: 'Perfil no encontrado' };

  return {
    title: `${perfil.nombre}${perfil.cargo ? ` · ${perfil.cargo}` : ''}`,
    description: perfil.bio.slice(0, 160) || `Conoce a ${perfil.nombre}.`,
  };
}

export default async function PaginaPerfil({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const perfil = await traerPerfil(slug);

  // Una ficha que el equipo quitó del portal deja de existir para el vecino,
  // aunque el enlace siga circulando por WhatsApp.
  if (!perfil) notFound();

  return <PerfilView perfil={perfil} />;
}
