import { supabaseNavegador } from '@/shared/lib/supabase/client';

const LADO_MAXIMO = 1600;
const CALIDAD = 0.82;

/**
 * Reduce la foto antes de subirla. Una foto de un celular moderno pesa entre 4
 * y 12 MB; subirla entera desde datos móviles en El Triunfo tarda una eternidad
 * y muchos abandonan a medio camino. Reducida a 1600px pesa unos 300 KB y se ve
 * igual de bien en pantalla.
 */
export async function comprimirImagen(archivo: File): Promise<Blob> {
  if (!archivo.type.startsWith('image/')) return archivo;

  const bitmap = await createImageBitmap(archivo);
  const escala = Math.min(1, LADO_MAXIMO / Math.max(bitmap.width, bitmap.height));

  if (escala === 1 && archivo.size < 600_000) return archivo;

  const ancho = Math.round(bitmap.width * escala);
  const alto = Math.round(bitmap.height * escala);

  const lienzo = document.createElement('canvas');
  lienzo.width = ancho;
  lienzo.height = alto;

  const ctx = lienzo.getContext('2d');
  if (!ctx) return archivo;
  ctx.drawImage(bitmap, 0, 0, ancho, alto);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolver) =>
    lienzo.toBlob(resolver, 'image/jpeg', CALIDAD),
  );

  return blob ?? archivo;
}

/** Sube la foto del pedido a la carpeta del propio vecino. */
export async function subirFotoDePedido(archivo: File): Promise<string> {
  const supabase = supabaseNavegador();
  const { data: sesion } = await supabase.auth.getUser();
  const uid = sesion.user?.id;
  if (!uid) throw new Error('sin_sesion');

  const comprimida = await comprimirImagen(archivo);
  const nombre = `${uid}/${crypto.randomUUID()}.jpg`;

  const { error } = await supabase.storage.from('obras').upload(nombre, comprimida, {
    contentType: 'image/jpeg',
    upsert: false,
  });
  if (error) throw new Error(error.message);

  return supabase.storage.from('obras').getPublicUrl(nombre).data.publicUrl;
}

/**
 * Sube la nota de voz del pedido.
 *
 * Devuelve la RUTA dentro del bucket, no una URL: `notas` es privado — es la
 * voz de una persona contando lo que le pasa en su casa — y solo el equipo la
 * escucha, con un enlace firmado que el panel pide en el momento.
 */
export async function subirNotaDeVoz(audio: Blob): Promise<string> {
  const supabase = supabaseNavegador();
  const { data: sesion } = await supabase.auth.getUser();
  const uid = sesion.user?.id;
  if (!uid) throw new Error('sin_sesion');

  // La extensión importa: la API de transcripción decide el contenedor por ella.
  const extension = audio.type.includes('mp4')
    ? 'mp4'
    : audio.type.includes('ogg')
      ? 'ogg'
      : audio.type.includes('mpeg')
        ? 'mp3'
        : 'webm';

  const ruta = `${uid}/${crypto.randomUUID()}.${extension}`;

  const { error } = await supabase.storage.from('notas').upload(ruta, audio, {
    contentType: audio.type || 'audio/webm',
    upsert: false,
  });
  if (error) throw new Error(error.message);

  return ruta;
}

/**
 * Sube contenido del portal (fotos, recortes, logo, video) bajo la carpeta de
 * la ciudad. El recorte del candidato se sube tal cual cuando es PNG: pasarlo
 * por el compresor lo convierte a JPEG y le devuelve el fondo blanco que
 * alguien se tomó el trabajo de recortar.
 */
export async function subirArchivoDePortal(ciudadId: string, archivo: File): Promise<string> {
  const supabase = supabaseNavegador();

  const esVideo = archivo.type.startsWith('video/');
  const conservarTalCual = esVideo || archivo.type === 'image/png' || archivo.type === 'image/svg+xml';

  const cuerpo = conservarTalCual ? archivo : await comprimirImagen(archivo);
  const extension = conservarTalCual
    ? (archivo.name.split('.').pop()?.toLowerCase() ?? 'bin')
    : 'jpg';
  const nombre = `${ciudadId}/${crypto.randomUUID()}.${extension}`;

  const { error } = await supabase.storage.from('portal').upload(nombre, cuerpo, {
    contentType: conservarTalCual ? archivo.type : 'image/jpeg',
    upsert: false,
  });
  if (error) throw new Error(error.message);

  return supabase.storage.from('portal').getPublicUrl(nombre).data.publicUrl;
}

/** Sube media de avance del equipo, bajo la carpeta de su ciudad. */
export async function subirMediaDeAvance(ciudadId: string, archivo: File): Promise<{
  tipo: 'foto' | 'video';
  url: string;
}> {
  const supabase = supabaseNavegador();
  const esVideo = archivo.type.startsWith('video/');

  const cuerpo = esVideo ? archivo : await comprimirImagen(archivo);
  const extension = esVideo ? (archivo.name.split('.').pop() ?? 'mp4') : 'jpg';
  const nombre = `${ciudadId}/${crypto.randomUUID()}.${extension}`;

  const { error } = await supabase.storage.from('publicaciones').upload(nombre, cuerpo, {
    contentType: esVideo ? archivo.type : 'image/jpeg',
    upsert: false,
  });
  if (error) throw new Error(error.message);

  return {
    tipo: esVideo ? 'video' : 'foto',
    url: supabase.storage.from('publicaciones').getPublicUrl(nombre).data.publicUrl,
  };
}
