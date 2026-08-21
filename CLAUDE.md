# AI Career Analyzer

Analisador de currículo e perfil de LinkedIn, client-side, sem backend.
Fonte única da lógica de domínio: `docs/prompt_agente_analise_carreira.md`.
Nunca reescreva ou resuma esse prompt em outro arquivo. Referencie.

## Stack

- Next.js (App Router) + TypeScript strict + Tailwind
- `pdfjs-dist` — extração de PDF client-side
- `@huggingface/transformers` — embeddings via ONNX/WASM (`all-MiniLM-L6-v2`)
- `@mlc-ai/web-llm` — inferência local via WebGPU (só a partir do Sprint 7)
- Zod — validação de todo output estruturado
- Web Workers para PDF, embeddings e LLM. Nada pesado na main thread.

Zero backend, zero chamada de API, zero dado do usuário saindo do browser.
Se uma solução exigir servidor, ela está errada.

## Regras invioláveis

### 1. Split determinístico
Nunca use LLM para o que TypeScript resolve. Isso inclui:
aritmética de datas, lacunas de emprego, contagem de caracteres,
redação de PII, detecção de seções, match literal de termos.
Se você está prompt-engineering algo que um regex resolve, pare.

### 2. Zero fabricação — como invariante de código, não como promessa de prompt
Todo achado gerado por modelo passa por dois filtros antes de renderizar.
Falhou em qualquer um: **descarta**. Não corrige, não reescreve, descarta.

```ts
// src/lib/grounding.ts
const norm = (s: string) => s.replace(/\s+/g, ' ').trim();

export const isGrounded = (quote: string, source: string) =>
  norm(source).includes(norm(quote));

export const numbersOK = (out: string, allowed: Set<string>) =>
  [...out.matchAll(/\d[\d.,]*/g)].every(m => allowed.has(m[0]));
```

`allowed` = números presentes no documento original + números que o
usuário digitou nas respostas da Fase 3. Nada mais.

### 3. Citação obrigatória
Todo achado tem `quote: string` apontando para trecho verbatim do original.
Sem quote, o achado não existe. Schema Zod deve tornar o campo obrigatório.

### 4. Métrica ausente
Nunca estime, nunca use placeholder inventado.
Use exatamente: `[FALTA NÚMERO: o que medir]`

### 5. Senioridade por escopo
Enum: `Júnior | Pleno | Sênior | Especialista | Gestor | Diretor`
Classificada por escopo de decisão, responsabilidade e liderança.
Título formal tem o MENOR peso.
Output sempre com três campos: nível comprovado, nível prometido, distância.

### 6. Julgue o documento
Crítica aponta o texto. Nunca a pessoa.

### 7. PII
Redigida no pré-processamento. Sinalizada uma vez na Fase 2.
Nunca reaparece em nenhum output.

## Ordem de construção

O motor determinístico vem inteiro antes de qualquer inferência.
WebLLM é a última camada e é opcional por design — o app tem que
entregar valor com WebGPU indisponível, porque a maioria dos
aparelhos não tem. Ver `ROADMAP.md`.

## Convenções

- `src/lib/` — TypeScript puro, sem React, testável isoladamente
- `src/workers/` — Web Workers
- `src/schemas/` — Zod
- Todo módulo em `src/lib/` precisa de teste com currículo real como fixture
- Sem dependência nova sem justificar por que a stdlib/plataforma não resolve

## Next.js 16

Esta versão é mais nova que o corte de treino dos modelos e tem breaking
changes. Antes de escrever código de Next, ler o guia relevante em
`node_modules/next/dist/docs/`.

@AGENTS.md
