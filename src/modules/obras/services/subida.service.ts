import { type ImagenLista, prepararImagen } from '@/shared/lib/imagen';
import { supabaseNavegador } from '@/shared/lib/supabase/client';

/**
 * Todo lo que sube al almacenamiento pasa por aquí.
 *
 * Las fotos van SIEMPRE por `prepararImagen`, que las encoge y las convierte a
 * WebP: es la única puerta, y por eso no hay forma de que un formulario nuevo
 * se olvide de comprimir. El video y el audio suben tal cual — recodificarlos
 * en el navegador tardaría más que subirlos.
 */

/** Lo que no es imagen sube intacto, pero con la misma forma que lo demás. */
function sinTocar(archivo: File): ImagenLista {
  return {
    cuerpo: archivo,
    tipo: archivo.type,
    extension: archivo.name.split('.').pop()?.toLowerCase() || 'bin',
  };
}

/** Sube la foto del pedido a la carpeta del propio vecino. */
export async function subirFotoDePedido(archivo: File): Promise<string> {
  const supabase = supabaseNavegador();
  const { data: sesion } = await supabase.auth.getUser();
  const uid = sesion.user?.id;
  if (!uid) throw new Error('sin_sesion');

  const imagen = await prepararImagen(archivo);
  const nombre = `${uid}/${crypto.randomUUID()}.${imagen.extension}`;

  const { error } = await supabase.storage.from('obras').upload(nombre, imagen.cuerpo, {
    contentType: imagen.tipo,
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
 * la ciudad.
 *
 * El recorte del candidato y el logo ya NO se salvan de la conversión: antes se
 * subían tal cual porque el compresor los pasaba a JPEG y les devolvía el fondo
 * blanco que alguien se tomó el trabajo de recortar. WebP conserva la
 * transparencia, así que ahora también adelgazan — y son los archivos más
 * pesados del portal, porque un PNG con recorte no comprime nada.
 */
export async function subirArchivoDePortal(ciudadId: string, archivo: File): Promise<string> {
  const supabase = supabaseNavegador();

  const contenido = archivo.type.startsWith('video/')
    ? sinTocar(archivo)
    : await prepararImagen(archivo);

  const nombre = `${ciudadId}/${crypto.randomUUID()}.${contenido.extension}`;

  const { error } = await supabase.storage.from('portal').upload(nombre, contenido.cuerpo, {
    contentType: contenido.tipo,
    upsert: false,
  });
  if (error) throw new Error(error.message);

  return supabase.storage.from('portal').getPublicUrl(nombre).data.publicUrl;
}

/** Sube media de avance del equipo, bajo la carpeta de su ciudad. */
export async function subirMediaDeAvance(
  ciudadId: string,
  archivo: File,
): Promise<{ tipo: 'foto' | 'video'; url: string }> {
  const supabase = supabaseNavegador();
  const esVideo = archivo.type.startsWith('video/');

  const contenido = esVideo ? sinTocar(archivo) : await prepararImagen(archivo);
  const nombre = `${ciudadId}/${crypto.randomUUID()}.${contenido.extension}`;

  const { error } = await supabase.storage.from('publicaciones').upload(nombre, contenido.cuerpo, {
    contentType: contenido.tipo,
    upsert: false,
  });
  if (error) throw new Error(error.message);

  return {
    tipo: esVideo ? 'video' : 'foto',
    url: supabase.storage.from('publicaciones').getPublicUrl(nombre).data.publicUrl,
  };
}
