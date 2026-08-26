import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const base = process.env.NEXT_PUBLIC_SITIO_URL ?? '';
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        // El panel no tiene nada que hacer en un buscador.
        disallow: ['/panel/', '/api/'],
      },
    ],
    sitemap: base ? `${base}/sitemap.xml` : undefined,
  };
}
