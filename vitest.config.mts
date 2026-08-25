import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  test: {
    // src/lib é TypeScript puro, sem React nem DOM. Ver CLAUDE.md > Convenções.
    environment: 'node',
    include: ['tests/**/*.test.ts', 'src/**/*.test.ts'],
    // O primeiro teste que toca uma fixture paga o import do build legacy do
    // pdfjs, e com os arquivos rodando em paralelo isso passa dos 5 s padrão
    // numa máquina fria. Não é lentidão do código: é uma vez por execução.
    testTimeout: 20_000,
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
});
