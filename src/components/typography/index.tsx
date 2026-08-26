import * as React from 'react';

import { Slot } from '@radix-ui/react-slot';
import { type VariantProps, cva } from 'class-variance-authority';

import { cn } from '@/shared/lib/utils';

/**
 * Nunca un <h1> suelto en un componente. El tracking negativo de los titulares
 * es el sello del sistema; si cada pantalla lo escribe a mano, se pierde.
 */
const tituloVariantes = cva('font-sans antialiased text-balance', {
  variants: {
    nivel: {
      display:
        'text-[2.25rem] leading-[1.02] font-extrabold tracking-[-0.04em] sm:text-[3rem] lg:text-[3.75rem]',
      h1: 'text-[1.75rem] leading-[1.08] font-bold tracking-[-0.035em] lg:text-[2.5rem]',
      h2: 'text-[1.375rem] leading-[1.15] font-bold tracking-[-0.025em] lg:text-[1.875rem]',
      h3: 'text-[1.125rem] leading-[1.25] font-semibold tracking-[-0.015em]',
      h4: 'text-[1rem] leading-[1.3] font-semibold',
      etiqueta: 'text-[0.7rem] font-bold tracking-[0.16em] uppercase',
    },
    tono: {
      fuerte: 'text-fg-strong',
      normal: 'text-fg-default',
      apagado: 'text-fg-muted',
      tenue: 'text-fg-subtle',
      inverso: 'text-fg-inverse',
      marca: 'text-teal',
      accion: 'text-ambar',
    },
  },
  defaultVariants: { nivel: 'h2', tono: 'fuerte' },
});

const NIVEL_A_ETIQUETA = {
  display: 'h1',
  h1: 'h1',
  h2: 'h2',
  h3: 'h3',
  h4: 'h4',
  etiqueta: 'p',
} as const;

export function Titulo({
  className,
  nivel = 'h2',
  tono,
  as,
  asChild,
  ...props
}: React.ComponentProps<'h2'> &
  VariantProps<typeof tituloVariantes> & {
    as?: React.ElementType;
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot : (as ?? NIVEL_A_ETIQUETA[nivel ?? 'h2']);
  return <Comp className={cn(tituloVariantes({ nivel, tono }), className)} {...props} />;
}

const textoVariantes = cva('font-sans antialiased', {
  variants: {
    tamano: {
      xs: 'text-[0.75rem] leading-[1.45]',
      sm: 'text-[0.8125rem] leading-[1.5]',
      base: 'text-[0.9375rem] leading-[1.6]',
      lg: 'text-[1.0625rem] leading-[1.6]',
    },
    tono: {
      fuerte: 'text-fg-strong',
      normal: 'text-fg-default',
      apagado: 'text-fg-muted',
      tenue: 'text-fg-subtle',
      inverso: 'text-fg-inverse',
      marca: 'text-teal',
    },
    peso: {
      normal: 'font-normal',
      medio: 'font-medium',
      fuerte: 'font-semibold',
    },
  },
  defaultVariants: { tamano: 'base', tono: 'apagado', peso: 'normal' },
});

export function Texto({
  className,
  tamano,
  tono,
  peso,
  as,
  ...props
}: React.ComponentProps<'p'> & VariantProps<typeof textoVariantes> & { as?: React.ElementType }) {
  const Comp = as ?? 'p';
  return <Comp className={cn(textoVariantes({ tamano, tono, peso }), className)} {...props} />;
}
