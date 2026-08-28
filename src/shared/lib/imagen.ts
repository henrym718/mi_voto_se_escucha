/**
 * Módulo ÚNICO de conversión de imágenes.
 *
 * TODA foto que entre a la aplicación —la del pedido del vecino, el avance que
 * publica el equipo, el logo y la portada del candidato— pasa por aquí y sale
 * en WebP liviano. Si aparece otro sitio que suba fotos, que use esto.
 *
 * Por qué importa acá y no es una optimización de manual: el vecino de El
 * Triunfo sube desde datos móviles, con la foto de 4 a 12 MB que da un celular
 * moderno. Reducida a 1600 px y convertida a WebP queda en unos 150 KB —la
 * mitad que el JPEG equivalente— y eso es la diferencia entre un pedido
 * enviado y uno abandonado a media barra de progreso. Del otro lado, cada
 * tarjeta del listado carga una foto: el peso se paga otra vez en cada visita.
 *
 * El algoritmo viene del panel de comercios de Pronto, donde un local carga
 * cientos de productos de una sentada.
 */

/** El formato al que se convierte todo. */
export const TIPO_WEBP = 'image/webp';

/**
 * 0.85, la misma cifra que usa Pronto.
 *
 * Medido sobre una foto de 4000x3000 y 1651 KB, ya encogida a 1600 px:
 *   JPEG 0.82 (lo que hacía esto antes) . 385 KB
 *   WebP 0.85 (lo que hace ahora) ...... 352 KB   -9 %
 *   WebP 0.80 .......................... 287 KB  -25 %
 *
 * Es decir: bajar a 0.80 ahorra bastante más y en la pantalla de un teléfono
 * cuesta encontrar la diferencia. Se deja en 0.85 porque es el valor que ya
 * corre en producción en Pronto sobre este mismo tipo de foto, y porque en las
 * fotos de los pedidos suelen aparecer carteles y placas de calle que el equipo
 * necesita poder leer. Si hiciera falta apretar más, este número es el que se
 * toca y no hay que cambiar nada más.
 */
const CALIDAD = 0.85;

/** Lado mayor. Más que esto no se ve en ninguna pantalla donde se muestra. */
const LADO_MAXIMO = 1600;

const EXTENSIONES: Record<string, string> = {
  'image/webp': 'webp',
  'image/jpeg': 'jpg',
  'image/png': 'png',
};

export interface ImagenLista {
  /** Lo que se sube. */
  cuerpo: Blob;
  /** El mime REAL del cuerpo. Nunca se supone: se lee de lo que salió. */
  tipo: string;
  /** La extensión que le corresponde a ese mime. */
  extension: string;
}

function extensionDelNombre(archivo: File): string {
  return archivo.name.split('.').pop()?.toLowerCase() || 'bin';
}

function talCual(archivo: File): ImagenLista {
  return { cuerpo: archivo, tipo: archivo.type, extension: extensionDelNombre(archivo) };
}

function aBlob(lienzo: HTMLCanvasElement, tipo: string, calidad: number): Promise<Blob | null> {
  return new Promise((resolver) => lienzo.toBlob(resolver, tipo, calidad));
}

/**
 * Deja una imagen lista para subir: encogida a `ladoMaximo` y convertida a WebP.
 *
 * Devuelve también el tipo y la extensión porque quien sube los necesita, y
 * porque adivinarlos es justo donde esto se rompe: si el navegador no sabe
 * codificar WebP, el archivo sale en otro formato y subirlo etiquetado como
 * WebP lo deja roto en el bucket para siempre.
 *
 * Nunca lanza. Ante cualquier duda devuelve el archivo original intacto: que
 * una foto suba pesada es un problema; que no suba es perder el pedido.
 */
export async function prepararImagen(
  archivo: File,
  ladoMaximo = LADO_MAXIMO,
): Promise<ImagenLista> {
  // El SVG es vectorial. Dibujarlo en un lienzo lo convierte en píxeles y le
  // quita las dos cosas por las que alguien eligió un SVG: pesa nada y se ve
  // nítido a cualquier tamaño. Solo el bucket del portal lo acepta, y ahí es
  // casi siempre el logo.
  if (!archivo.type.startsWith('image/') || archivo.type === 'image/svg+xml') {
    return talCual(archivo);
  }

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(archivo);
  } catch {
    // Un formato que este navegador no sabe decodificar —HEIC en varios
    // Android—. Sube tal cual: el bucket lo acepta y se ve en el panel.
    return talCual(archivo);
  }

  const escala = Math.min(1, ladoMaximo / Math.max(bitmap.width, bitmap.height));
  const ancho = Math.round(bitmap.width * escala);
  const alto = Math.round(bitmap.height * escala);

  const lienzo = document.createElement('canvas');
  lienzo.width = ancho;
  lienzo.height = alto;

  const ctx = lienzo.getContext('2d');
  if (!ctx) {
    bitmap.close();
    return talCual(archivo);
  }
  ctx.drawImage(bitmap, 0, 0, ancho, alto);
  bitmap.close();

  let blob = await aBlob(lienzo, TIPO_WEBP, CALIDAD);
  if (!blob) return talCual(archivo);

  // Un navegador sin WebP en el lienzo (Safari anterior al 14) no avisa: le
  // pides WebP y te devuelve un PNG. Un PNG de una foto pesa MÁS que el JPEG
  // original, así que ahí se recodifica al formato de siempre... salvo que el
  // original fuera PNG, porque entonces puede tener transparencia y pasarlo a
  // JPEG le devuelve el fondo blanco que alguien se tomó el trabajo de recortar.
  if (blob.type !== TIPO_WEBP && archivo.type !== 'image/png') {
    blob = (await aBlob(lienzo, 'image/jpeg', CALIDAD)) ?? blob;
  }

  // Si no hubo que encoger y el resultado pesa más que el original, gana el
  // original: esto existe para quitar peso, no para cambiar de formato.
  if (escala === 1 && blob.size >= archivo.size) return talCual(archivo);

  return {
    cuerpo: blob,
    tipo: blob.type,
    extension: EXTENSIONES[blob.type] ?? extensionDelNombre(archivo),
  };
}
