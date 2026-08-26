import { ImageResponse } from 'next/og';

import { supabaseServidor } from '@/shared/lib/supabase/server';

export const alt = 'Obra pedida por los vecinos';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

/**
 * La tarjeta que aparece cuando alguien pega el enlace en el grupo de WhatsApp.
 * Lleva el contador de apoyos a propósito: un número concreto ("412 vecinos")
 * convence de tocar el enlace mucho más que un título solo.
 */
export default async function Imagen({ params }: { params: Promise<{ codigo: string }> }) {
  const { codigo } = await params;
  const supabase = await supabaseServidor();
  const { data } = await supabase.rpc('obra_detalle', { p_codigo: codigo.toUpperCase() });

  const respuesta = data as unknown as {
    success: boolean;
    obra?: {
      titulo: string;
      apoyos: number;
      ciudadela: { nombre: string };
      categoria: { nombre: string };
      estado: { nombre: string; color: string };
      ciudad: { nombre: string };
    };
  } | null;

  const obra = respuesta?.success ? respuesta.obra : null;

  if (!obra) {
    return new ImageResponse(
      (
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#faf6ef',
            fontSize: 56,
            fontWeight: 800,
            color: '#1c1a20',
          }}
        >
          Mi Voto Se Escucha
        </div>
      ),
      size,
    );
  }

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: '#faf6ef',
          padding: 72,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              background: obra.estado.color,
              color: 'white',
              borderRadius: 999,
              padding: '10px 24px',
              fontSize: 26,
              fontWeight: 700,
            }}
          >
            {obra.estado.nombre}
          </div>
          <div style={{ display: 'flex', fontSize: 26, color: '#8b8993' }}>
            {obra.ciudadela.nombre} · {obra.categoria.nombre}
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            fontSize: 68,
            fontWeight: 800,
            color: '#1c1a20',
            lineHeight: 1.1,
            letterSpacing: '-0.03em',
            maxWidth: 1000,
          }}
        >
          {obra.titulo.length > 90 ? `${obra.titulo.slice(0, 90)}…` : obra.titulo}
        </div>

        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', fontSize: 90, fontWeight: 800, color: '#0d7d6c', lineHeight: 1 }}>
              {new Intl.NumberFormat('es-EC').format(obra.apoyos)}
            </div>
            <div style={{ display: 'flex', fontSize: 30, color: '#4a4852', marginTop: 8 }}>
              {obra.apoyos === 1 ? 'vecino apoya este pedido' : 'vecinos apoyan este pedido'}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
            <div style={{ display: 'flex', fontSize: 30, fontWeight: 800, color: '#1c1a20' }}>
              Mi Voto Se Escucha
            </div>
            <div style={{ display: 'flex', fontSize: 24, color: '#8b8993' }}>
              {obra.ciudad.nombre}
            </div>
          </div>
        </div>
      </div>
    ),
    size,
  );
}
