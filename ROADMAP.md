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

- [x] Worker com `pdfjs-dist`, texto + posição (x, y, fontSize)
- [x] Detecção de layout de duas colunas por clustering de x
- [x] Reconstrução em ordem de leitura
- [x] Entrada alternativa: textarea para colar LinkedIn

**Pronto quando:** os 5 fixtures saem em texto legível e na ordem certa.

**Desvios:** sem worker próprio — o `pdfjs` já parseia dentro do worker dele
e a reconstrução de layout custa milissegundos. Duas colunas saem por calha
vazia em x (`findGutter`), não por clustering: a calha é a faixa que nenhum
item atravessa, e cabeçalho largo corta a página em blocos horizontais.
A posição usada é a altura da fonte, não o `fontSize` declarado.

Layout de duas colunas é onde o `pdfjs` te trai. Se um fixture quebrar,
resolva agora — todo o resto herda o erro.

---

## Sprint 2 — Motor determinístico · 5h · semana de 07/09

TypeScript puro em `src/lib/`. Nenhum modelo envolvido.

- [x] `pii.ts` — regex para telefone BR/intl, e-mail, CPF, CEP, data de nascimento, estado civil. Retorna texto redigido + lista do que achou
- [x] `dates.ts` — parse de períodos PT/EN (`jan/2020 – atual`, `2018-2021`), cálculo de lacunas e permanências curtas em ms
- [x] `sections.ts` — slicing em Header / Resumo / Experiência / Formação / Competências por heurística de heading (fontSize + keywords)
- [x] `limits.ts` — contagem de caracteres por campo. Headline LinkedIn = 220, About = 2600

**Pronto quando:** cada módulo tem teste contra os 5 fixtures.

**Desvios:** `pii.ts` ganhou RG, endereço, idade e sexo além da lista, porque
os fixtures traziam os quatro. `dates.ts` trabalha em meses, não em ms —
currículo não declara dia. `sections.ts` usa só palavra-chave e formato da
linha, sem `fontSize`: a entrada por textarea não tem informação de fonte
nenhuma e precisa funcionar igual. Ele fatia mais que os cinco tipos
previstos — Contato, Idiomas e Certificações também.

Isso já cobre três itens do grupo "Lacunas" da Fase 2 do prompt,
com precisão total e zero VRAM.

---

## Sprint 3 — UI de correção · 5h · semana de 14/09

- [x] Upload + progresso
- [x] Vista lado a lado: texto extraído à esquerda, seções detectadas à direita
- [x] Usuário reatribui trechos entre seções (o parser vai errar)
- [x] Painel de PII detectada
- [x] Timeline com lacunas marcadas

**Pronto quando:** você corrige um fixture mal-parseado em menos de 1 minuto.
Ainda não verificado no navegador — falta o teste com clique.

**Desvios:** o painel de PII mostra tipo e quantidade, nunca o valor, e a
timeline é montada só sobre as linhas atribuídas a Experiência — datas de
formação abririam lacunas que não são de emprego.

---

## Sprint 4 — v0 utilizável · 5h · semana de 21/09 · **MARCO**

- [x] Formulário de contexto: cargo-alvo, nível-alvo, setor, país, restrições de divulgação
- [x] Se o usuário não souber o cargo-alvo: campo livre + aviso de que a análise sai genérica sem isso. A derivação automática de direções fica para o Sprint 8
- [x] Colar de 2 a 5 vagas-alvo (texto, não link)
- [x] Montador que gera o dossiê estruturado + prompt completo → clipboard
- [x] Export em `.md`

**Pronto quando:** você e um amigo rodam uma análise completa de ponta a ponta
colando o output em qualquer chat, e o resultado é melhor que colar o PDF cru.
Ainda não verificado com uma pessoa de fora.

**Desvios:** sem cargo-alvo, o dossiê não deriva direção nenhuma — ele
instrui o modelo a derivar, que é texto estático e não a derivação automática
do Sprint 8. O piso de 2 vagas não é imposto pela interface: uma vaga só
gera dossiê, com aviso de que o vocabulário é de uma empresa. E o formulário
cobre 5 das 6 prioridades da Fase 3 — números reais e ambiguidades de
histórico continuam sendo pergunta do modelo, sinalizada no dossiê.

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
