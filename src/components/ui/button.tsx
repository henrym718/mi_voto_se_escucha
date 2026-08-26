import * as React from 'react';

import { Slot } from '@radix-ui/react-slot';
import { type VariantProps, cva } from 'class-variance-authority';

import { cn } from '@/shared/lib/utils';

/**
 * Píldora siempre. Es el sello del sistema de diseño y lo que hace que la
 * interfaz se sienta amable en lugar de burocrática — que en una app cívica
 * importa: la gente ya asocia lo cuadrado con el municipio.
 *
 * El hundimiento de 1px al presionar (`active:translate-y-px`) da la respuesta
 * táctil que en móvil se echa de menos cuando la red va lenta.
 */
const botonVariantes = cva(
  [
    'inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-full',
    'border border-transparent bg-clip-padding text-sm font-semibold',
    'transition-all duration-150 outline-none',
    'focus-visible:ring-3 focus-visible:ring-ring/40',
    'disabled:pointer-events-none disabled:opacity-50',
    'active:translate-y-px',
    "[&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4",
  ].join(' '),
  {
    variants: {
      variant: {
        default: 'bg-tinta text-crema hover:bg-tinta/90 shadow-sm',
        accion: 'bg-ambar text-white hover:bg-ambar-hondo shadow-sm',
        institucional: 'bg-teal text-white hover:bg-teal-hondo shadow-sm',
        outline: 'border-linea bg-white text-fg-default hover:bg-crema-2',
        suave: 'bg-teal-pastel text-teal-hondo hover:bg-teal-pastel/70',
        ghost: 'text-fg-muted hover:bg-crema-2 hover:text-fg-default',
        // Destructivo en tinte, nunca rojo pleno: no queremos asustar a nadie.
        destructive: 'bg-peligro-pastel text-peligro hover:bg-peligro-pastel/70',
        link: 'text-teal underline-offset-4 hover:underline',
      },
      size: {
        // 44px de alto mínimo en los tamaños táctiles: mucha gente mayor usa esto.
        default: 'h-11 px-5 has-[>svg]:px-4',
        sm: 'h-9 px-4 text-[0.8rem]',
        lg: 'h-13 px-7 text-base',
        xl: 'h-14 px-8 text-base',
        icon: 'size-11',
        'icon-sm': 'size-9',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
);

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<'button'> &
  VariantProps<typeof botonVariantes> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : 'button';
  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      className={cn(botonVariantes({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, botonVariantes };
