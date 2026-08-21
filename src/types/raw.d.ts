/** Import de arquivo como string crua (`?raw`), suportado por Turbopack e Vitest. */
declare module '*?raw' {
  const content: string;
  export default content;
}
