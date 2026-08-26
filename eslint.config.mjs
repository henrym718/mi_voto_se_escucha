import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    '.next/**',
    'out/**',
    'build/**',
    'next-env.d.ts',
    // Las Edge Functions corren en Deno: sus importaciones por URL y su API
    // global no existen en el mundo de Node y solo generan ruido aquí.
    'supabase/**',
    // Documentos y lienzos de diseño, no código de la aplicación.
    'docs/**',
    'src/types/database.types.ts',
  ]),
]);

export default eslintConfig;
