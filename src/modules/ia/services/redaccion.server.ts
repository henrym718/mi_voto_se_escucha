import 'server-only';

/**
 * Reescritura del pedido con Gemini.
 *
 * El vecino cuenta el problema como lo contaría en la tienda de la esquina —
 * hablando, con vueltas, sin saber si escribir "alcantarillado" o "aguas
 * servidas". Eso está bien: pedirle un título de 8 a 120 caracteres y una
 * descripción ordenada es pedirle que redacte un oficio, y el que no se siente
 * capaz simplemente no publica.
 *
 * Aquí el modelo hace UNA sola cosa: ordenar lo que la persona ya dijo. No
 * adorna, no infiere, no rellena. Si el texto no alcanza, lo dice y devuelve
 * una pregunta concreta en vez de inventarse el resto.
 */

const PUNTO_FINAL = 'https://generativelanguage.googleapis.com/v1beta/models';

/** El mismo modelo que ya usa el otro proyecto del equipo. */
const MODELO_POR_DEFECTO = 'gemini-3.5-flash';

export interface PedidoRedactado {
  titulo: string;
  descripcion: string;
  /** true cuando lo que contó la persona no alcanza para publicar. */
  necesita_mas: boolean;
  /** Qué falta, en una pregunta que se le puede mostrar tal cual. */
  pregunta: string;
}

const INSTRUCCION = `
Eres el ayudante de redacción de una plataforma cívica del cantón El Triunfo,
Ecuador, donde los vecinos piden obras para su barrio.

Recibes lo que un vecino contó sobre un problema de su barrio: puede venir
escrito a la carrera o transcrito de una nota de voz, con muletillas, repeticiones
y errores.

Tu único trabajo es ordenarlo para que cualquiera lo entienda de una pasada.

REGLAS INNEGOCIABLES
- Usa SOLO datos que estén en el mensaje. Nunca inventes calles, cantidades,
  fechas, número de familias, causas ni responsables.
- Si algo no se dijo, no aparece. Es preferible un texto corto a uno completo
  pero inventado.
- Español ecuatoriano neutro y sencillo, como se habla. Nada de lenguaje de
  oficio: prohibido "se solicita comedidamente", "la presente", "en virtud de",
  "cabe mencionar", "es menester".
- Nada de adjetivos de campaña ni juicios políticos. Describe el problema, no
  culpes a nadie.
- No prometas ni sugieras soluciones técnicas que el vecino no mencionó.

TÍTULO
- Entre 20 y 90 caracteres.
- Empieza por QUÉ hace falta o QUÉ está mal, y dónde si se dijo.
- Sin punto final, sin comillas, sin mayúsculas sostenidas.
- Ejemplo: "Rejilla rota en la calle 4 frente a la escuela".

DESCRIPCIÓN
- Entre 1 y 3 frases. Máximo 400 caracteres. Frases cortas.
- Qué pasa, desde cuándo y a quién afecta — solo lo que se haya dicho.
- Sin repetir el título palabra por palabra.
- Sin listas ni viñetas.

CUÁNDO PEDIR MÁS
- Si el mensaje no deja claro QUÉ hace falta (por ejemplo "arreglen el barrio"
  o "esto está feo"), pon necesita_mas en true, deja titulo y descripcion
  vacíos, y escribe en pregunta UNA sola pregunta corta y concreta, tuteando.
- Si se entiende qué hace falta, necesita_mas es false y pregunta va vacía,
  aunque falten detalles.
`.trim();

const ESQUEMA = {
  type: 'OBJECT',
  properties: {
    titulo: { type: 'STRING' },
    descripcion: { type: 'STRING' },
    necesita_mas: { type: 'BOOLEAN' },
    pregunta: { type: 'STRING' },
  },
  required: ['titulo', 'descripcion', 'necesita_mas', 'pregunta'],
} as const;

export async function redactarPedido(entrada: {
  mensaje: string;
  ciudadela?: string;
  categoria?: string;
}): Promise<PedidoRedactado> {
  const clave = process.env.GEMINI_API_KEY;
  if (!clave) throw new Error('Falta GEMINI_API_KEY en el entorno del servidor');

  const modelo = process.env.GEMINI_MODEL ?? MODELO_POR_DEFECTO;

  // El contexto va como dato etiquetado, no mezclado en la frase: el modelo no
  // debe confundir "el vecino vive en Las Mercedes" con "el problema está en
  // Las Mercedes" si el mensaje nunca lo dijo.
  const contexto = [
    entrada.ciudadela ? `Ciudadela del vecino: ${entrada.ciudadela}` : null,
    entrada.categoria ? `Categoría elegida: ${entrada.categoria}` : null,
  ]
    .filter(Boolean)
    .join('\n');

  const respuesta = await fetch(`${PUNTO_FINAL}/${modelo}:generateContent`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-goog-api-key': clave },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: INSTRUCCION }] },
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: `${contexto ? `${contexto}\n\n` : ''}Mensaje del vecino:\n"""\n${entrada.mensaje.slice(0, 4000)}\n"""`,
            },
          ],
        },
      ],
      generationConfig: {
        // Temperatura baja: aquí no queremos creatividad, queremos fidelidad.
        temperature: 0.2,
        maxOutputTokens: 600,
        responseMimeType: 'application/json',
        responseSchema: ESQUEMA,
      },
    }),
  });

  if (!respuesta.ok) {
    const detalle = await respuesta.text();
    throw new Error(`Gemini respondió ${respuesta.status}: ${detalle.slice(0, 300)}`);
  }

  const cuerpo = (await respuesta.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };

  const texto = cuerpo.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? '';
  if (!texto.trim()) throw new Error('Gemini devolvió una respuesta vacía');

  const datos = JSON.parse(texto) as Partial<PedidoRedactado>;

  // El recorte a 120 no es cosmético: la columna `titulo` de obras lo exige y
  // un modelo puede pasarse aunque le pidamos 90.
  const titulo = (datos.titulo ?? '').trim().slice(0, 120);
  const descripcion = (datos.descripcion ?? '').trim().slice(0, 1000);
  const necesitaMas = Boolean(datos.necesita_mas) || titulo.length < 8;

  return {
    titulo: necesitaMas ? '' : titulo,
    descripcion: necesitaMas ? '' : descripcion,
    necesita_mas: necesitaMas,
    pregunta: necesitaMas
      ? (datos.pregunta ?? '').trim() || '¿Qué hace falta exactamente y en qué parte del barrio?'
      : '',
  };
}
