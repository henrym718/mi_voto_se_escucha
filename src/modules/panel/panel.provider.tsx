'use client';

import { type ReactNode, createContext, useContext } from 'react';

interface Admin {
  id: string;
  rol: 'admin' | 'editor' | 'candidato';
  nombre: string;
}

interface Ciudad {
  id: string;
  slug: string;
  nombre: string;
  modo: string;
}

interface Contexto {
  ciudad: Ciudad;
  admin: Admin;
  puedeEditar: boolean;
}

const PanelContext = createContext<Contexto | null>(null);

export function usePanel() {
  const ctx = useContext(PanelContext);
  if (!ctx) throw new Error('usePanel se usa dentro de <PanelProvider>');
  return ctx;
}

export function PanelProvider({
  ciudad,
  admin,
  puedeEditar,
  children,
}: Contexto & { children: ReactNode }) {
  return (
    <PanelContext.Provider value={{ ciudad, admin, puedeEditar }}>{children}</PanelContext.Provider>
  );
}
