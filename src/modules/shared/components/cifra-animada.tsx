'use client';

import { useEffect, useRef, useState } from 'react';

import { animate } from 'motion/react';

import { cifra as formatear } from '@/shared/lib/utils';

/**
 * El contador sube cuando entra en pantalla. En una app cívica el número de
 * vecinos ES el argumento: verlo crecer dice "esto ya está pasando" mejor que
 * cualquier texto.
 *
 * Arranca mostrando el valor real, no cero. Así el número correcto se ve en el
 * servidor, no hay salto al hidratar, y si la animación no llega a correr (sin
 * IntersectionObserver, movimiento reducido, pestaña en segundo plano) lo que
 * queda en pantalla sigue siendo el dato bueno y no un cero falso.
 */
export function CifraAnimada({
  valor,
  duracion = 1.1,
  className,
}: {
  valor: number;
  duracion?: number;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const yaAnimado = useRef(false);
  const [mostrado, setMostrado] = useState(valor);
  const [valorPrevio, setValorPrevio] = useState(valor);

  // Si el dato cambia (una consulta que se refresca), se muestra el nuevo al
  // instante. Ajustar el estado durante el render es el patrón que React
  // recomienda para esto; hacerlo en un efecto provoca un render de más.
  if (valor !== valorPrevio) {
    setValorPrevio(valor);
    setMostrado(valor);
  }

  useEffect(() => {
    const nodo = ref.current;
    if (!nodo || yaAnimado.current || valor === 0) return;

    if (
      typeof IntersectionObserver === 'undefined' ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      return;
    }

    let control: ReturnType<typeof animate> | null = null;

    const observador = new IntersectionObserver(
      (entradas) => {
        if (!entradas[0]?.isIntersecting || yaAnimado.current) return;
        yaAnimado.current = true;
        observador.disconnect();

        control = animate(0, valor, {
          duration: duracion,
          ease: [0.16, 1, 0.3, 1],
          onUpdate: (v) => setMostrado(Math.round(v)),
          onComplete: () => setMostrado(valor),
        });
      },
      { threshold: 0.2 },
    );

    observador.observe(nodo);

    return () => {
      observador.disconnect();
      control?.stop();
    };
  }, [valor, duracion]);

  return (
    <span ref={ref} className={className}>
      {formatear(mostrado)}
    </span>
  );
}
