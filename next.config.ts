import type { NextConfig } from 'next';

/**
 * O app é estático por natureza — não há backend, não há rota de API, nada
 * roda no servidor. `export` só torna isso explícito para o build.
 *
 * `basePath` porque o GitHub Pages serve em `usuario.github.io/<repo>`, não
 * na raiz. Vale também em `npm run dev`: o app passa a abrir em
 * localhost:3000/Resume-Reviewer.
 */
const nextConfig: NextConfig = {
  output: 'export',
  basePath: '/Resume-Reviewer',
  turbopack: {
    // `docs/prompt_agente_analise_carreira.md` é importado cru por
    // `src/lib/prompt.ts`. Ver `tools/raw-loader.cjs`.
    rules: {
      '*.md': {
        loaders: ['./tools/raw-loader.cjs'],
        as: '*.js',
      },
    },
  },
};

export default nextConfig;
