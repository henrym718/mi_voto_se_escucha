import type { Metadata } from 'next';

import { ObraDetalleView } from '@/modules/obras/views/obra-detalle.view';
import { ciudadActual } from '@/shared/config/ciudad';
import { supabaseServidor } from '@/shared/lib/supabase/server';

interface Props {
  params: Promise<{ codigo: string }>;
}

async function traerObra(codigo: string) {
  const supabase = await supabaseServidor();
  const { data } = await supabase.rpc('obra_detalle', { p_codigo: codigo.toUpperCase() });
  const respuesta = data as unknown as { success: boolean; obra?: never } | null;
  return respuesta?.success ? respuesta.obra : null;
}

/**
 * El enlace que se comparte al grupo del barrio pasa por aquí. Sin estas
 * etiquetas llega como texto pelado y nadie lo toca; con ellas llega con
 * título, resumen e imagen, y ese enlace es el motor de crecimiento entero.
 */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { codigo } = await params;
  const obra = (await traerObra(codigo)) as
    | { titulo: string; apoyos: number; ciudadela: { nombre: string }; descripcion: string }
    | null;

  if (!obra) return { title: 'Obra no encontrada' };

  const titulo = obra.titulo;
  const descripcion =
    obra.apoyos > 0
      ? `${obra.apoyos} ${obra.apoyos === 1 ? 'vecino apoya' : 'vecinos apoyan'} este pedido en ${obra.ciudadela.nombre}. Súmate para que entre al plan de obras.`
      : `Un pedido de ${obra.ciudadela.nombre}. Apóyalo para que entre al plan de obras.`;

  return {
    title: titulo,
    description: descripcion,
    openGraph: { title: titulo, description: descripcion, type: 'article' },
    twitter: { card: 'summary_large_image', title: titulo, description: descripcion },
  };
}

export default async function PaginaObra({ params }: Props) {
  const { codigo } = await params;
  const obra = await traerObra(codigo);
  await ciudadActual();

  return <ObraDetalleView codigo={codigo.toUpperCase()} inicial={obra ?? undefined} />;
}
