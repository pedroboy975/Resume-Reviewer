/**
 * Loader de arquivo cru para o Turbopack.
 *
 * Existe para `src/lib/prompt.ts` importar o prompt direto de `docs/`, em vez
 * de manter uma cópia dele dentro do código — o que o CLAUDE.md proíbe.
 * O Vitest resolve `?raw` sozinho; o Turbopack precisa de um loader, e o
 * loader inteiro é esta linha. Não vale uma dependência nova.
 */
module.exports = function rawLoader(source) {
  return `export default ${JSON.stringify(source)};`;
};
