# Roadmap

Orçamento: ~5h/semana. Sprint = 1 semana.
Marco que importa: **Sprint 4 — app utilizável de verdade.**
Tudo depois disso é melhoria sobre algo que já funciona.

---

## Sprint 0 — Higiene · 2h · semana de 24/08

- [x] `create-next-app` com TypeScript + Tailwind, App Router
- [x] `docs/` recebe o prompt de carreira e a spec técnica. Deletar o arquivo duplicado
- [x] `CLAUDE.md` na raiz
- [x] Vitest configurado
- [x] Coletar 5 currículos reais em PDF como fixtures (seus, de amigos, anonimizados)

**Pronto quando:** `npm test` roda e passa com um teste trivial.

Os 5 PDFs não são opcionais. Sem eles você desenvolve contra um currículo
imaginário e descobre no Sprint 3 que o parser não serve.

---

## Sprint 1 — Extração · 5h · semana de 31/08

- [x] `pdfjs-dist`, texto + posição (x, y, altura). Sem worker próprio: o `pdfjs` já parseia no worker dele e a reconstrução custa milissegundos
- [x] Detecção de layout de duas colunas por calha vazia em x (`findGutter`)
- [x] Reconstrução em ordem de leitura, com cabeçalho que atravessa a calha cortando a página em blocos
- [x] Entrada alternativa: textarea para colar LinkedIn

**Pronto quando:** os 5 fixtures saem em texto legível e na ordem certa.

Layout de duas colunas é onde o `pdfjs` te trai. Se um fixture quebrar,
resolva agora — todo o resto herda o erro.

---

## Sprint 2 — Motor determinístico · 5h · semana de 07/09

TypeScript puro em `src/lib/`. Nenhum modelo envolvido.

- [x] `pii.ts` — e-mail (inclusive quebrado em duas linhas pela barra lateral do LinkedIn), telefone BR/intl, CPF, RG, CEP, endereço, data de nascimento, idade, estado civil, sexo. Retorna texto redigido + lista do que achou
- [x] `dates.ts` — parse de períodos PT/EN (`jan/2020 – atual`, `2018-2021`, `Agosto/2013 á Março/2014`), lacunas e permanências curtas em meses
- [x] `sections.ts` — slicing em Cabeçalho / Contato / Resumo / Experiência / Formação / Competências / Idiomas / Certificações. Só palavra-chave e formato da linha: a entrada por textarea não tem informação de fonte, e precisa funcionar igual
- [x] `limits.ts` — contagem de caracteres por campo. Headline LinkedIn = 220, About = 2600

**Pronto quando:** cada módulo tem teste contra os 5 fixtures.

Isso já cobre três itens do grupo "Lacunas" da Fase 2 do prompt,
com precisão total e zero VRAM.

---

## Sprint 3 — UI de correção · 5h · semana de 14/09

- [x] Upload + progresso página a página
- [x] Vista lado a lado: texto extraído à esquerda, seções montadas à direita
- [x] Usuário reatribui trechos entre seções: clique na linha, shift+clique estende, botão escolhe a seção
- [x] Painel de PII detectada — tipo e quantidade, nunca o valor
- [x] Timeline com lacunas marcadas, montada só sobre as linhas atribuídas a Experiência

**Pronto quando:** você corrige um fixture mal-parseado em menos de 1 minuto.

---

## Sprint 4 — v0 utilizável · 5h · semana de 21/09 · **MARCO**

- [x] Formulário de contexto: cargo-alvo, nível-alvo, setor, país, restrições de divulgação
- [x] Se o usuário não souber o cargo-alvo: campo livre + aviso de que a análise sai genérica sem isso, e o dossiê manda o modelo derivar de 2 a 3 direções antes de reescrever
- [x] Colar de 2 a 5 vagas-alvo (texto, não link)
- [x] Montador que gera o dossiê estruturado + prompt completo → clipboard
- [x] Export em `.md`

**Pronto quando:** você e um amigo rodam uma análise completa de ponta a ponta
colando o output em qualquer chat, e o resultado é melhor que colar o PDF cru.

A partir daqui você tem produto. Pare, use por duas semanas antes do Sprint 5,
e anote o que incomoda. Essa lista vale mais que este roadmap.

---

## Sprints 5–6 — Matching semântico · 10h · semanas de 28/09 e 05/10

- [ ] Worker Transformers.js + `all-MiniLM-L6-v2` em WASM
- [ ] Extração de termos das vagas coladas (frequência + n-gramas)
- [ ] **Match literal primeiro.** Cosine similarity só para agrupar sinônimos e variações morfológicas
- [ ] Tabela presente / ausente / diferencial (Fase 4.4 do prompt)
- [ ] Verificação explícita: o termo que define a área da pessoa aparece no título, no resumo E nas competências?

**Pronto quando:** roda em iPhone. WASM não precisa de WebGPU — é o que
garante que a maioria dos aparelhos recebe algo útil.

---

## Sprints 7–9 — Camada WebLLM · ~15h · a partir de 12/10

Opcional por design. App tem que funcionar inteiro sem ela.

**Sprint 7 — infra**
- [ ] Detecção de WebGPU + VRAM, com degradação silenciosa
- [ ] Worker com `@mlc-ai/web-llm`, Qwen2.5-1.5B-Instruct q4f16
- [ ] Tela de download com progresso e cache em IndexedDB
- [ ] `grounding.ts` implementado e testado ANTES do primeiro prompt

**Sprint 8 — micro-prompt de diagnóstico**
Escopo mínimo: só Fase 2, e só os grupos "Lacunas" e "Ruído custoso".
- [ ] Um bullet por chamada. Nunca o documento inteiro
- [ ] Schema Zod estrito, retry uma vez em falha de parse, depois desiste
- [ ] Todo achado passa por `isGrounded` e `numbersOK`

**Não peça contradições ao modelo de 1.5B.** As detectáveis já saem do TS:
datas que não fecham, idioma declarado × responsabilidade geográfica,
título de gestor × ausência de subordinados.

**Sprint 9 — reescrita**
- [ ] Bullets, um por chamada, formato Ação + Método + Problema + Resultado
- [ ] Só números confirmados pelo usuário. `numbersOK` bloqueia o resto
- [ ] Headline: 5 opções por estratégia

---

## Critérios de corte

Corte a camada WebLLM inteira se, no Sprint 8, mais de 30% dos achados
forem descartados pelos filtros de grounding. Nesse caso o v0 do Sprint 4
já é o produto, e a demo técnica passa a ser o motor determinístico +
matching semântico — que é honesto e funciona em qualquer aparelho.

Corte qualquer sprint que atrase duas semanas seguidas. Com 5h/semana,
sprint travado não é atraso: é sinal de escopo errado.
