# AI Career Analyzer

Analisador de currículo e perfil de LinkedIn, **client-side, sem backend**.
Extrai o texto de um PDF, redige dados pessoais, calcula lacunas e
permanências curtas, deixa você corrigir o fatiamento em seções e monta um
dossiê para colar em qualquer chat de IA — que é onde a análise de fato
acontece.

Nenhum arquivo sai do navegador. Sem servidor, sem chamada de API, sem
telemetria.

A lógica de domínio (as seis fases da análise de carreira) vive em
[`docs/prompt_agente_analise_carreira.md`](docs/prompt_agente_analise_carreira.md)
e é lida direto de lá — nunca copiada. Para o contexto de produto completo,
veja [`PRODUCT.md`](PRODUCT.md); para as regras invioláveis do projeto,
[`CLAUDE.md`](CLAUDE.md).

## Rodando localmente

```bash
npm install
npm run dev
```

Abra [http://localhost:3000](http://localhost:3000). Suba um PDF (currículo,
ou o "Salvar como PDF" do próprio perfil do LinkedIn) ou cole o texto direto.

## Scripts

```bash
npm run dev        # servidor de desenvolvimento
npm run build       # build de produção
npm run test         # roda a suíte (vitest)
npm run typecheck   # tsc --noEmit
npm run lint         # eslint
```

## Stack

- Next.js (App Router) + TypeScript strict + Tailwind
- `pdfjs-dist` — extração de PDF client-side
- Zod — validação de todo output estruturado
- Web Workers para trabalho pesado fora da main thread

## Estrutura

- `src/lib/` — TypeScript puro (parsing, datas, PII, montagem do dossiê), sem
  React, testável isoladamente
- `src/components/` — UI
- `src/schemas/` — validação Zod
- `docs/` — prompt de análise e spec técnica
- `tests/` — suíte com fixtures de currículos/PDFs reais (não versionados,
  contêm dados pessoais)

## Regras do projeto

Split determinístico antes de qualquer inferência, zero fabricação (todo
achado gerado por modelo precisa de citação verbatim do original), e PII
redigida no pré-processamento e nunca reexibida. Detalhes completos em
[`CLAUDE.md`](CLAUDE.md).
