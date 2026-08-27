import 'server-only';

/**
 * Transcripción de la nota de voz con Whisper.
 *
 * Por qué Whisper y no Gemini para esto: el audio llega de un celular de gama
 * baja, en la calle, con perros y motos de fondo, y en español ecuatoriano.
 * Whisper acepta `language` y un `prompt` de contexto, y con esas dos cosas
 * deja de "traducir" nombres propios y de saltar al portugués cuando el audio
 * se ensucia. Es el mismo montaje que ya funciona en el otro proyecto.
 *
 * El reparto queda así: Whisper oye, Gemini ordena. Cada uno en lo que es
 * bueno, y si mañana uno de los dos falla o sube de precio se cambia solo esa
 * mitad.
 */

const MODELO_POR_DEFECTO = 'whisper-1';

/** 25 MB es el tope de la API; el grabador nunca se acerca, pero el archivo
 *  puede llegar de otro lado y un 413 sin explicar es un callejón sin salida. */
const TAMANO_MAXIMO = 25 * 1024 * 1024;

const CONTEXTO =
  'El vecino habla en español de Ecuador sobre un problema de su barrio: ' +
  'calles, alcantarillado, agua potable, alumbrado, parques, basura, rejillas, ' +
  'aceras, canchas. Puede nombrar ciudadelas y calles del cantón El Triunfo.';

export async function transcribirAudio(archivo: File): Promise<string> {
  const clave = process.env.OPENAI_API_KEY;
  if (!clave) throw new Error('Falta OPENAI_API_KEY en el entorno del servidor');

  if (archivo.size > TAMANO_MAXIMO) throw new Error('audio_muy_grande');

  const cuerpo = new FormData();
  cuerpo.append('file', archivo, archivo.name || 'nota.webm');
  cuerpo.append('model', process.env.OPENAI_TRANSCRIBE_MODEL ?? MODELO_POR_DEFECTO);
  cuerpo.append('language', 'es');
  cuerpo.append('prompt', CONTEXTO);
  cuerpo.append('response_format', 'text');

  const respuesta = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${clave}` },
    body: cuerpo,
  });

  if (!respuesta.ok) {
    const detalle = await respuesta.text();
    throw new Error(`Whisper respondió ${respuesta.status}: ${detalle.slice(0, 300)}`);
  }

  // Con response_format=text la respuesta es el texto pelado, sin JSON que
  // parsear ni campo que pueda venir con otro nombre.
  return (await respuesta.text()).trim();
}
