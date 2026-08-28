'use client';

import { Titulo } from '@/components/typography';

interface Props {
  nombre: string;
  cargo: string;
  partido: string;
  eslogan: string;
  fotoUrl: string | null;
  bannerUrl: string | null;
}

/**
 * La portada del candidato: la banda con su cara que abre la home cuando el
 * equipo enciende el interruptor en el panel.
 *
 * Nace apagada, y conviene saber por qué antes de encenderla: la propaganda de
 * cartelera en el primer pliegue dispara el filtro anti-política y mucha gente
 * se va antes de ver una sola obra. El resto de la portada está construida
 * justo al revés —titular, sector, causas— y esta banda va en contra de eso.
 *
 * Aun así existe, y existe entera: hay campañas que exigen la foto arriba, y
 * esa es una decisión del cliente, no del código. Lo que hace el código es
 * dejarla apagada de fábrica y decir el costo al lado del interruptor.
 */
export function HeroCandidato({ nombre, cargo, partido, eslogan, fotoUrl, bannerUrl }: Props) {
  if (!nombre && !fotoUrl && !eslogan) return null;

  return (
    <section className="border-tinta relative overflow-hidden rounded-[28px] border">
      <div
        className="relative h-28 md:h-36"
        style={{
          background: `linear-gradient(150deg, var(--color-marca) 0%, color-mix(in oklab, var(--color-marca) 72%, black) 100%)`,
        }}
      >
        {bannerUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={bannerUrl} alt="" className="absolute inset-0 size-full object-cover" />
        )}
      </div>

      <div className="flex flex-col gap-3 px-5 pb-5 md:px-7 md:pb-6">
        <div className="-mt-12 md:-mt-14">
          {fotoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={fotoUrl}
              alt={nombre}
              className="border-tinta size-24 rounded-full border-4 bg-white object-cover md:size-28"
            />
          ) : null}
        </div>

        <div className="flex flex-col gap-2">
          {nombre && <Titulo nivel="h2">{nombre}</Titulo>}
          <div className="flex flex-wrap gap-2">
            {cargo && (
              <span className="bg-tinta rounded-full px-3.5 py-1.5 text-[0.8125rem] font-bold text-white">
                {cargo}
              </span>
            )}
            {partido && (
              <span className="border-tinta text-fg-strong rounded-full border px-3.5 py-1.5 text-[0.8125rem] font-bold">
                {partido}
              </span>
            )}
          </div>
          {eslogan && (
            <Titulo nivel="h3" tono="fuerte" className="max-w-[30ch]">
              “{eslogan}”
            </Titulo>
          )}
        </div>
      </div>
    </section>
  );
}
