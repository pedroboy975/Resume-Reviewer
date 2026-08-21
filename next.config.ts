import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
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
