'use client';

import { useState } from 'react';

import { Download, Loader2, ShieldCheck, Users } from 'lucide-react';
import { motion } from 'motion/react';

import { Texto, Titulo } from '@/components/typography';
import { Button } from '@/components/ui/button';
import { useCategorias } from '@/modules/catalogo/hooks/use-catalogo';
import { CifraAnimada } from '@/modules/shared/components/cifra-animada';
import { cifra, cn, porcentaje } from '@/shared/lib/utils';

import { useRanking } from '../hooks/use-panel';
import { usePanel } from '../panel.provider';

/**
 * El tablero que justifica la factura. Lo que se le vende al candidato no es
 * una lista de quejas: es saber, barrio por barrio y con teléfonos verificados
 * detrás, qué prometer el sábado en la tarima.
 */
export function RankingView() {
  const { ciudad } = usePanel();
  const [categoriaId, setCategoriaId] = useState<string | null>(null);
  const { data, isLoading } = useRanking(ciudad.id, categoriaId);
  const { data: categorias = [] } = useCategorias(ciudad.id);

  function exportarCsv() {
    if (!data) return;
    const filas = [
      ['Ciudadela', 'Verificada', 'Vecinos', 'Obras', 'Apoyos', 'Obra mas pedida', 'Apoyos top', '% del barrio'],
      ...data.ciudadelas.map((c) => [
        c.nombre,
        c.verificado ? 'si' : 'por verificar',
        c.vecinos,
        c.obras,
        c.apoyos,
        c.top[0]?.titulo ?? '',
        c.top[0]?.apoyos ?? '',
        c.top[0]?.porcentaje ?? '',
      ]),
    ];
    // El punto y coma es el separador que Excel en español espera; con comas
    // el comando abre el archivo y ve todo apelotonado en una columna.
    const csv = filas.map((f) => f.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(';')).join('\n');
    const url = URL.createObjectURL(new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `demanda-${ciudad.slug}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (isLoading || !data) {
    return (
      <div className="flex items-center gap-2 py-16">
        <Loader2 className="text-teal size-5 animate-spin" />
        <Texto tamano="sm">Calculando la demanda…</Texto>
      </div>
    );
  }

  const conVecinos = data.ciudadelas.filter((c) => c.vecinos > 0 || c.apoyos > 0);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <Titulo nivel="h1">Ranking por barrio</Titulo>
          <Texto tamano="sm">
            Ordenado por vecinos verificados. El porcentaje corrige el sesgo del barrio grande.
          </Texto>
        </div>
        <Button variant="outline" onClick={exportarCsv}>
          <Download />
          Exportar
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          { valor: data.totales.vecinos, etiqueta: 'vecinos verificados', clase: 'bg-teal-pastel text-teal-hondo' },
          { valor: data.totales.apoyos, etiqueta: 'apoyos totales', clase: 'bg-ambar-pastel text-ambar-hondo' },
          { valor: data.totales.obras, etiqueta: 'obras publicadas', clase: 'bg-lavanda text-morado' },
          { valor: data.totales.en_cola, etiqueta: 'por revisar', clase: 'bg-crema-2 text-fg-muted' },
        ].map((t) => (
          <div key={t.etiqueta} className={cn('flex flex-col gap-0.5 rounded-2xl p-4', t.clase)}>
            <CifraAnimada valor={t.valor} className="cifra text-[1.75rem] leading-none font-extrabold" />
            <span className="text-[0.75rem] font-medium opacity-80">{t.etiqueta}</span>
          </div>
        ))}
      </div>

      {/* ------------------------------------------- reparto por categoría -- */}
      <section className="flex flex-col gap-3">
        <Titulo nivel="h3">De qué se queja la gente</Titulo>
        <div className="border-linea flex flex-col gap-2 rounded-2xl border bg-white p-4">
          {data.categorias
            .filter((c) => c.apoyos > 0)
            .map((cat, i) => {
              const maximo = Math.max(...data.categorias.map((c) => c.apoyos), 1);
              const proporcion = data.totales.apoyos > 0 ? (cat.apoyos / data.totales.apoyos) * 100 : 0;
              return (
                <div key={cat.id} className="flex items-center gap-3">
                  <span className="text-fg-default w-40 shrink-0 truncate text-[0.8125rem] font-medium">
                    {cat.nombre}
                  </span>
                  <div className="bg-crema-2 h-6 flex-1 overflow-hidden rounded-lg">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${(cat.apoyos / maximo) * 100}%` }}
                      transition={{ duration: 0.7, delay: i * 0.06, ease: [0.16, 1, 0.3, 1] }}
                      className="bg-teal h-full rounded-lg"
                    />
                  </div>
                  <span className="cifra text-fg-strong w-24 shrink-0 text-right text-[0.8125rem] font-bold">
                    {cifra(cat.apoyos)}
                    <span className="text-fg-subtle ml-1 font-medium">
                      {porcentaje(Math.round(proporcion * 10) / 10)}
                    </span>
                  </span>
                </div>
              );
            })}
          {data.categorias.every((c) => c.apoyos === 0) && (
            <Texto tamano="sm" className="py-4 text-center">
              Todavía no hay apoyos que repartir.
            </Texto>
          )}
        </div>
      </section>

      {/* ---------------------------------------------- ranking por barrio -- */}
      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Titulo nivel="h3">Barrio por barrio</Titulo>
          <select
            value={categoriaId ?? ''}
            onChange={(e) => setCategoriaId(e.target.value || null)}
            className="border-linea focus:border-teal h-10 rounded-xl border bg-white px-3 text-[0.8125rem] font-medium outline-none"
          >
            <option value="">Todas las categorías</option>
            {categorias.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </select>
        </div>

        {conVecinos.length === 0 ? (
          <div className="border-linea rounded-2xl border border-dashed bg-white px-6 py-12 text-center">
            <Texto tamano="sm">
              Todavía no hay vecinos verificados. Los números aparecen en cuanto alguien apoye
              su primera obra.
            </Texto>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {conVecinos.map((barrio, i) => (
              <motion.article
                key={barrio.id}
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-40px' }}
                transition={{ duration: 0.3, delay: Math.min(i, 6) * 0.04 }}
                className="border-linea flex flex-col gap-3 rounded-2xl border bg-white p-4"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-fg-strong text-[1rem] font-bold">{barrio.nombre}</span>
                  {barrio.verificado ? (
                    <ShieldCheck className="text-exito size-4" aria-label="Confirmada por documento municipal" />
                  ) : (
                    <span className="bg-arena text-alerta rounded-full px-2 py-0.5 text-[0.65rem] font-bold">
                      por verificar
                    </span>
                  )}
                  <span className="text-fg-subtle ml-auto flex items-center gap-1 text-[0.8125rem]">
                    <Users className="size-3.5" />
                    <span className="cifra font-bold">{cifra(barrio.vecinos)}</span> vecinos
                  </span>
                </div>

                {barrio.top.length > 0 ? (
                  <ol className="flex flex-col gap-1.5">
                    {barrio.top.map((obra, j) => (
                      <li key={obra.id} className="flex items-center gap-2.5">
                        <span className="cifra text-fg-faint w-4 shrink-0 text-[0.8125rem] font-bold">
                          {j + 1}
                        </span>
                        <span className="text-fg-default min-w-0 flex-1 truncate text-[0.875rem]">
                          {obra.titulo}
                        </span>
                        <span
                          className="hidden shrink-0 rounded-full px-2 py-0.5 text-[0.65rem] font-bold sm:inline"
                          style={{ backgroundColor: `${obra.estado_color}1a`, color: obra.estado_color }}
                        >
                          {obra.estado}
                        </span>
                        <span className="cifra text-teal w-20 shrink-0 text-right text-[0.8125rem] font-bold">
                          {cifra(obra.apoyos)}
                          {obra.porcentaje > 0 && (
                            <span className="text-fg-subtle ml-1 font-medium">
                              {porcentaje(obra.porcentaje)}
                            </span>
                          )}
                        </span>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <Texto tamano="sm" tono="tenue">
                    Sin pedidos todavía en este barrio.
                  </Texto>
                )}
              </motion.article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
