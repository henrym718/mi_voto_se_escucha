'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';

import { Check, Copy, Download, ExternalLink, Loader2, QrCode } from 'lucide-react';
import QRCode from 'qrcode';
import { toast } from 'sonner';

import { Texto, Titulo } from '@/components/typography';
import { Button } from '@/components/ui/button';

import { usePanel } from '../panel.provider';

/** Lo que se imprime en un cartel de tres metros no puede ser un PNG de 300px. */
const LADO_PNG = 2048;

/**
 * El QR para carteles, adhesivos y afiches.
 *
 * La dirección NO se escribe a mano en ningún sitio: sale de la variable de
 * entorno del despliegue. Hoy apunta a staging y el día que se compre el
 * dominio propio, el mismo cartel generado desde aquí ya apunta a él sin que
 * nadie tenga que acordarse de cambiar nada.
 *
 * El enlace lleva `?via=qr` pegado. Es lo que separa «imprimimos cinco mil
 * adhesivos» de «sabemos si los cinco mil adhesivos sirvieron»: el vecino que
 * entra por ahí queda marcado con origen `qr` cuando deja su número.
 *
 * Se descarga en SVG y en PNG, y las dos cosas hacen falta: el SVG es vectorial
 * y es lo que pide la imprenta —un cartel de tres metros con un PNG se ve a
 * cuadros—, y el PNG es lo que se manda por WhatsApp al diseñador.
 */
export function DifusionView() {
  const { ciudad } = usePanel();

  // La dirección sale del despliegue. El respaldo es la del propio navegador,
  // para que en un ambiente sin la variable el QR no acabe apuntando a la nada
  // sin que nadie se entere hasta ver los carteles impresos.
  //
  // Con useSyncExternalStore y no con un efecto: `window` no existe al pintar
  // en el servidor, y esta es la forma que da React de leer algo que solo
  // existe en el navegador sin desajustar la hidratación ni encadenar renders.
  const origenNavegador = useSyncExternalStore(
    () => () => {},
    () => window.location.origin,
    () => '',
  );
  const base = process.env.NEXT_PUBLIC_SITIO_URL || origenNavegador;

  const [titular, setTitular] = useState('Tu voto se escucha');
  const [pie, setPie] = useState('Escanea y pide la obra que le hace falta a tu barrio');
  const [svgQr, setSvgQr] = useState('');
  const [copiado, setCopiado] = useState(false);
  const [generando, setGenerando] = useState(false);

  const enlace = base ? `${base}/?via=qr` : '';

  useEffect(() => {
    if (!enlace) return;
    let vivo = true;
    // Corrección alta: un adhesivo pegado en un poste se raya, se moja y se le
    // despega una esquina. Con nivel H sigue leyéndose con un tercio del
    // código destruido.
    void QRCode.toString(enlace, {
      type: 'svg',
      errorCorrectionLevel: 'H',
      margin: 0,
      color: { dark: '#111113', light: '#ffffff' },
    }).then((svg) => {
      if (vivo) setSvgQr(svg);
    });
    return () => {
      vivo = false;
    };
  }, [enlace]);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(enlace);
      setCopiado(true);
      toast.success('Enlace copiado.');
      setTimeout(() => setCopiado(false), 2200);
    } catch {
      toast.error('No pudimos copiar el enlace.');
    }
  }

  async function descargar(pieza: 'qr' | 'cartel', formato: 'svg' | 'png') {
    setGenerando(true);
    try {
      const nombre = `mvse-${pieza}-${ciudad.slug}.${formato}`;
      const svg =
        pieza === 'qr'
          ? await svgSoloQr(enlace)
          : await svgDelCartel(enlace, titular, pie, ciudad.nombre);

      if (formato === 'svg') {
        bajar(new Blob([svg], { type: 'image/svg+xml' }), nombre);
      } else {
        bajar(await svgAPng(svg, LADO_PNG), nombre);
      }
    } catch {
      toast.error('No pudimos generar el archivo.');
    } finally {
      setGenerando(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1.5">
        <Titulo nivel="h1">QR para carteles</Titulo>
        <Texto tamano="sm">
          El código que la gente escanea para llegar a la página de {ciudad.nombre}. Descárgalo y
          mándalo a la imprenta: sirve igual para un adhesivo de cinco centímetros que para una
          valla.
        </Texto>
      </div>

      {/* ------------------------------------------------------- la dirección -- */}
      <section className="border-linea flex flex-col gap-3 rounded-2xl border bg-white p-4">
        <span className="text-fg-muted text-[0.7rem] font-bold tracking-[0.12em] uppercase">
          A dónde lleva
        </span>

        <div className="flex flex-wrap items-center gap-2">
          <code className="bg-crema-2 text-fg-strong min-w-0 flex-1 truncate rounded-xl px-3 py-2.5 text-[0.875rem] font-semibold">
            {enlace || 'Cargando…'}
          </code>
          <Button variant="outline" size="sm" onClick={() => void copiar()} disabled={!enlace}>
            {copiado ? <Check className="text-exito" /> : <Copy />}
            Copiar
          </Button>
          <Button variant="ghost" size="sm" asChild disabled={!enlace}>
            <a href={enlace} target="_blank" rel="noreferrer">
              <ExternalLink />
              Abrir
            </a>
          </Button>
        </div>

        <Texto tamano="xs" tono="tenue">
          Sale del despliegue, no está escrita a mano: cuando se cambie el dominio, este QR apunta
          solo al nuevo. El <code>?via=qr</code> del final es lo que deja ver en el ranking cuánta
          gente llegó por los carteles y no por WhatsApp.
        </Texto>
      </section>

      {/* ------------------------------------------------------------ el texto -- */}
      <section className="border-linea flex flex-col gap-3 rounded-2xl border bg-white p-4">
        <span className="text-fg-muted text-[0.7rem] font-bold tracking-[0.12em] uppercase">
          Qué dice el cartel
        </span>
        <input
          value={titular}
          onChange={(e) => setTitular(e.target.value.slice(0, 40))}
          placeholder="Tu voto se escucha"
          className="border-linea focus:border-tinta h-12 w-full rounded-xl border px-3 text-[1rem] font-bold outline-none"
        />
        <input
          value={pie}
          onChange={(e) => setPie(e.target.value.slice(0, 80))}
          placeholder="Escanea y pide la obra que le hace falta a tu barrio"
          className="border-linea focus:border-tinta h-11 w-full rounded-xl border px-3 text-[0.875rem] outline-none"
        />
        <Texto tamano="xs" tono="tenue">
          Se usa solo para armar el archivo que descargues; no se guarda en ningún lado.
        </Texto>
      </section>

      {/* ------------------------------------------------------- la vista previa -- */}
      <div className="grid gap-4 md:grid-cols-2">
        <Pieza
          titulo="El código solo"
          ayuda="Para que el diseñador lo monte en su propia pieza."
          onDescargar={(f) => void descargar('qr', f)}
          generando={generando}
        >
          <div
            className="mx-auto w-48 [&>svg]:size-full"
            // El SVG lo genera la librería a partir del enlace: no hay html de
            // fuera de aquí metiéndose en la página.
            dangerouslySetInnerHTML={{ __html: svgQr }}
          />
        </Pieza>

        <Pieza
          titulo="El cartel listo"
          ayuda="Con el texto de arriba. Se puede imprimir tal cual."
          onDescargar={(f) => void descargar('cartel', f)}
          generando={generando}
        >
          <div className="border-linea mx-auto flex w-full max-w-[15rem] flex-col items-center gap-3 rounded-xl border bg-white px-4 py-5 text-center">
            <span className="text-fg-strong text-[1.0625rem] leading-tight font-extrabold tracking-[-0.02em]">
              {titular || 'Tu voto se escucha'}
            </span>
            <div className="w-28 [&>svg]:size-full" dangerouslySetInnerHTML={{ __html: svgQr }} />
            <span className="text-fg-muted text-[0.6875rem] leading-tight font-semibold">
              {pie}
            </span>
            <span className="text-fg-faint text-[0.625rem] font-bold">
              {base.replace(/^https?:\/\//, '')}
            </span>
          </div>
        </Pieza>
      </div>

      {/* Lo que se aprende cuando vuelven mil adhesivos que nadie pudo escanear. */}
      <div className="bg-crema-2 flex flex-col gap-1 rounded-2xl px-4 py-3">
        <Texto tamano="sm" peso="fuerte" tono="normal">
          Antes de mandarlo a imprimir
        </Texto>
        <Texto tamano="sm">
          Manda el SVG, no el PNG: el PNG se ve a cuadros en cualquier cosa más grande que una hoja.
          No lo imprimas a menos de 2,5 cm de lado —abajo de eso los teléfonos no lo enganchan— y
          déjale el marco blanco alrededor, que no es adorno: sin él, la cámara no encuentra dónde
          empieza el código. Y pruébalo escaneándolo del cartel de verdad antes de mandar la tirada
          completa.
        </Texto>
      </div>
    </div>
  );
}

function Pieza({
  titulo,
  ayuda,
  children,
  onDescargar,
  generando,
}: {
  titulo: string;
  ayuda: string;
  children: React.ReactNode;
  onDescargar: (formato: 'svg' | 'png') => void;
  generando: boolean;
}) {
  return (
    <section className="border-linea flex flex-col gap-3 rounded-2xl border bg-white p-4">
      <div className="flex flex-col gap-0.5">
        <Texto tamano="sm" peso="fuerte" tono="normal">
          {titulo}
        </Texto>
        <Texto tamano="xs" tono="tenue">
          {ayuda}
        </Texto>
      </div>

      <div className="bg-crema-2 flex items-center justify-center rounded-xl p-4">{children}</div>

      <div className="flex gap-2">
        <Button
          variant="institucional"
          size="sm"
          disabled={generando}
          onClick={() => onDescargar('svg')}
        >
          {generando ? <Loader2 className="animate-spin" /> : <Download />}
          SVG
        </Button>
        <Button variant="outline" size="sm" disabled={generando} onClick={() => onDescargar('png')}>
          <QrCode />
          PNG
        </Button>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------- generación -- */

async function svgSoloQr(enlace: string): Promise<string> {
  // margin 4 = el marco blanco que exige la norma del QR. Sin él la cámara no
  // distingue dónde empieza el código y mucha gente cree que "no funciona".
  return QRCode.toString(enlace, {
    type: 'svg',
    errorCorrectionLevel: 'H',
    margin: 4,
    color: { dark: '#111113', light: '#ffffff' },
  });
}

/**
 * Arma el cartel en SVG, con el QR incrustado como vector y no como imagen.
 *
 * La librería devuelve un `<svg viewBox="0 0 N N">` con los módulos dentro; se
 * le saca el contenido y se coloca escalado dentro del lienzo del cartel. Así
 * el archivo entero sigue siendo vectorial y aguanta cualquier tamaño.
 */
async function svgDelCartel(
  enlace: string,
  titular: string,
  pie: string,
  ciudad: string,
): Promise<string> {
  const bruto = await QRCode.toString(enlace, {
    type: 'svg',
    errorCorrectionLevel: 'H',
    margin: 0,
    color: { dark: '#111113', light: '#ffffff' },
  });

  const caja = /viewBox="0 0 (\d+(?:\.\d+)?) /.exec(bruto);
  const modulos = caja ? Number(caja[1]) : 33;
  const dentro = bruto.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');

  const W = 1000;
  const H = 1300;
  const LADO = 620;
  const X = (W - LADO) / 2;
  const Y = 330;
  const escala = LADO / modulos;
  const dominio = enlace.replace(/^https?:\/\//, '').replace(/\/\?via=qr$/, '');

  // Sin tildes ni caracteres raros sin escapar: el archivo lo abre un programa
  // de diseño que no siempre perdona un & suelto.
  const limpio = (t: string) =>
    t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="#ffffff"/>
  <text x="${W / 2}" y="180" text-anchor="middle" font-family="Inter, Arial, Helvetica, sans-serif" font-size="86" font-weight="800" fill="#111113">${limpio(titular)}</text>
  <text x="${W / 2}" y="250" text-anchor="middle" font-family="Inter, Arial, Helvetica, sans-serif" font-size="34" font-weight="600" fill="#45454a">${limpio(ciudad)}</text>
  <rect x="${X - 24}" y="${Y - 24}" width="${LADO + 48}" height="${LADO + 48}" rx="28" fill="#ffffff" stroke="#e4e4e7" stroke-width="3"/>
  <g transform="translate(${X} ${Y}) scale(${escala})">${dentro}</g>
  <text x="${W / 2}" y="${Y + LADO + 120}" text-anchor="middle" font-family="Inter, Arial, Helvetica, sans-serif" font-size="38" font-weight="600" fill="#45454a">${limpio(pie)}</text>
  <text x="${W / 2}" y="${Y + LADO + 190}" text-anchor="middle" font-family="Inter, Arial, Helvetica, sans-serif" font-size="32" font-weight="800" fill="#8a8a90">${limpio(dominio)}</text>
</svg>`;
}

/** Rasteriza el SVG a PNG del lado pedido, sin salir del navegador. */
async function svgAPng(svg: string, lado: number): Promise<Blob> {
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  try {
    const img = new Image();
    await new Promise<void>((ok, mal) => {
      img.onload = () => ok();
      img.onerror = () => mal(new Error('no se pudo leer el svg'));
      img.src = url;
    });

    // Se respeta la proporción del original: el cartel es más alto que ancho y
    // forzarlo a un cuadrado lo dejaría estirado.
    const proporcion = img.height / img.width || 1;
    const lienzo = document.createElement('canvas');
    lienzo.width = lado;
    lienzo.height = Math.round(lado * proporcion);

    const ctx = lienzo.getContext('2d');
    if (!ctx) throw new Error('sin lienzo');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, lienzo.width, lienzo.height);
    ctx.drawImage(img, 0, 0, lienzo.width, lienzo.height);

    return await new Promise<Blob>((ok, mal) =>
      lienzo.toBlob((b) => (b ? ok(b) : mal(new Error('sin png'))), 'image/png'),
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}

function bajar(contenido: Blob, nombre: string) {
  const url = URL.createObjectURL(contenido);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  a.click();
  URL.revokeObjectURL(url);
}
