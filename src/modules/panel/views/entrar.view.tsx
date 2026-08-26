'use client';

import { useState } from 'react';

import { useRouter } from 'next/navigation';

import { Loader2, LogIn } from 'lucide-react';
import { toast } from 'sonner';

import { Texto, Titulo } from '@/components/typography';
import { Button } from '@/components/ui/button';
import { RUTAS } from '@/shared/config/rutas';
import { supabaseNavegador } from '@/shared/lib/supabase/client';

/**
 * El equipo entra con correo y contraseña, no con el código de WhatsApp: son
 * cuentas de trabajo que se crean una vez y se comparten dentro del comando,
 * no personas que se registran solas.
 */
export function EntrarView() {
  const router = useRouter();
  const [correo, setCorreo] = useState('');
  const [clave, setClave] = useState('');
  const [entrando, setEntrando] = useState(false);

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    setEntrando(true);
    try {
      const { error } = await supabaseNavegador().auth.signInWithPassword({
        email: correo.trim(),
        password: clave,
      });
      if (error) {
        toast.error('Correo o contraseña incorrectos.');
        return;
      }
      router.push(RUTAS.panel.tablero);
      router.refresh();
    } finally {
      setEntrando(false);
    }
  }

  return (
    <div className="bg-crema flex min-h-dvh items-center justify-center px-4">
      <form onSubmit={entrar} className="flex w-full max-w-sm flex-col gap-5">
        <div className="flex flex-col gap-1">
          <span className="text-teal text-[0.7rem] font-bold tracking-[0.16em] uppercase">
            Panel del equipo
          </span>
          <Titulo nivel="h1">Mi Voto Se Escucha</Titulo>
          <Texto tamano="sm">Entra con la cuenta que te dieron en el comando.</Texto>
        </div>

        <div className="flex flex-col gap-3">
          <input
            type="email"
            required
            autoComplete="email"
            placeholder="Correo"
            value={correo}
            onChange={(e) => setCorreo(e.target.value)}
            className="border-linea focus:border-teal focus:ring-teal/20 h-13 w-full rounded-xl border bg-white px-4 text-base outline-none transition-all focus:ring-3"
          />
          <input
            type="password"
            required
            autoComplete="current-password"
            placeholder="Contraseña"
            value={clave}
            onChange={(e) => setClave(e.target.value)}
            className="border-linea focus:border-teal focus:ring-teal/20 h-13 w-full rounded-xl border bg-white px-4 text-base outline-none transition-all focus:ring-3"
          />
        </div>

        <Button type="submit" variant="institucional" size="xl" disabled={entrando}>
          {entrando ? <Loader2 className="animate-spin" /> : <LogIn className="size-5" />}
          Entrar
        </Button>
      </form>
    </div>
  );
}
