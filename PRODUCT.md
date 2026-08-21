# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

O autor e pessoas próximas a ele — amigos e conhecidos que pedem ajuda com
currículo ou perfil de LinkedIn. Não é um produto aberto ao público, e a
decisão sobre publicar está em aberto (ver Operating Context).

A situação de uso é pontual, não recorrente: alguém está se recolocando ou
mirando um degrau acima, tem um PDF de currículo ou o "Salvar como PDF" do
próprio perfil do LinkedIn, e quer uma análise que valha mais do que colar
esse arquivo cru num chat de IA. Sentam uma vez, corrigem o que o parser
errou, geram o dossiê e levam para o chat que já usam.

## Product Purpose

Transformar um currículo ou perfil de LinkedIn em um dossiê estruturado que
se cola em qualquer chat de IA e produz uma análise de carreira melhor do
que a que sairia do documento cru.

O app não conversa com modelo nenhum. Ele prepara o material: extrai o texto
na ordem certa, redige dados pessoais, calcula o que é aritmética (lacunas
de emprego, permanências curtas, contagem de caracteres), deixa a pessoa
corrigir o fatiamento em seções, coleta o contexto que o prompt perguntaria,
e monta tudo junto com o prompt de análise.

**Sucesso, na régua do usuário:** colar o dossiê num chat dá resultado
melhor do que colar o PDF. Esse é o único critério confirmado, e ele ainda
não foi verificado com uma pessoa de fora.

## Positioning

O dossiê carrega achados marcados como **calculados, não inferidos** — datas,
lacunas, durações, contagens — com instrução explícita para o modelo não
recalcular nem contradizer. Um chat genérico recebendo o PDF cru refaz essa
conta de cabeça e erra; aqui ela chega pronta e correta.

O segundo diferencial é a fonte de verdade: o prompt de análise vive em
`docs/prompt_agente_analise_carreira.md` e é lido de lá, nunca copiado. O
que o app entrega é sempre a versão atual da lógica de domínio.

## Operating Context

- Roda inteiramente no navegador. Nenhum arquivo é enviado a lugar nenhum,
  não há backend, não há chamada de API.
- Hoje roda em `localhost` via `npm run dev`. **Onde será publicado, e se
  será, está em aberto** — não há decisão de deploy, domínio ou distribuição.
- O usuário chega com um PDF: currículo próprio, ou o export "Salvar como
  PDF" do perfil do LinkedIn (perfil → "Mais" → "Salvar como PDF"). Também
  pode colar texto direto.
- A saída sai por clipboard ou arquivo `.md`, e vai para um chat de IA de
  terceiro — que é onde a análise de fato acontece.
- O app não acessa o LinkedIn: sessão autenticada, acesso automatizado
  proibido nos termos de uso, e CORS bloquearia de qualquer forma.

## Capabilities and Constraints

**Faz hoje:** extração de PDF em ordem de leitura, inclusive layout de duas
colunas; redação de dados pessoais; fatiamento em seções com correção
manual pelo usuário; linha do tempo de empregos com lacunas; formulário de
contexto e vagas-alvo; montagem do dossiê para clipboard e `.md`.

**Restrições que o projeto se impôs** (do `CLAUDE.md`, e que valem como lei
mesmo não sendo a régua de sucesso):

- Zero backend. Se uma solução exigir servidor, ela está errada.
- Nada que TypeScript resolva pode ser delegado a um modelo: aritmética de
  datas, contagem, redação de PII, match literal.
- Zero fabricação como invariante de código, não como promessa de prompt.
  Todo achado gerado por modelo passa por filtro de citação verbatim e de
  números permitidos; falhou, descarta.
- Métrica ausente vira `[FALTA NÚMERO: o que medir]`, nunca estimativa.
- Dado pessoal é redigido no pré-processamento, sinalizado uma vez por tipo
  e quantidade, e nunca reaparece em nenhuma tela ou export.
- A camada de LLM local (WebLLM) é opcional por design e ainda não existe.
  O app precisa entregar valor com WebGPU indisponível, porque a maioria dos
  aparelhos não tem.

**Terminologia do domínio:** dossiê (o `.md` que o app monta), achado
determinístico (o que saiu de regex e aritmética), lacuna (intervalo sem
emprego acima de 4 meses), permanência curta (abaixo de 12 meses), seção
(Cabeçalho, Contato, Resumo, Experiência, Formação, Competências, Idiomas,
Certificações), tipo de artefato (LinkedIn, currículo, ou ambos).

**Níveis de senioridade**, enum fechado: Júnior, Pleno, Sênior, Especialista,
Gestor, Diretor — classificados por escopo de decisão, não por título.

## Brand Commitments

Interface e documentos em português do Brasil. Comentários de código também;
identificadores em inglês.

O tom do produto é o mesmo do prompt de análise: direto, sem suavizar
conclusão desfavorável, e sempre julgando o documento, nunca a pessoa.

Não há nome de produto confirmado — `ai-career-analyzer` é nome de
repositório. Não há logo, paleta ou identidade visual definida.

## Evidence on Hand

- `docs/prompt_agente_analise_carreira.md` — o prompt de análise de carreira
  em seis fases. Fonte única da lógica de domínio.
- `docs/spec_tecnica.md` — a spec técnica.
- `ROADMAP.md` — sprints 0 a 9, com desvios registrados por sprint.
- `tests/fixtures/` — 6 PDFs reais (4 currículos, 2 exports de LinkedIn),
  **não versionados**, porque contêm dados pessoais não anonimizados.
- 231 testes automatizados, incluindo verificação de ponta a ponta sobre os
  PDFs reais.

**Não existe, e não deve ser inventado:** usuário real fora do círculo
próximo, depoimento, benchmark, número de uso, comparação medida contra
outra ferramenta, ou qualquer evidência de que o dossiê supera o PDF cru —
esse teste ainda não foi feito.

## Product Principles

1. **O determinístico vem antes do inferido.** O que regex e aritmética
   resolvem não passa por modelo, e o que passa por modelo passa antes por
   filtro de citação.
2. **O parser vai errar, e a interface assume isso.** Corrigir o fatiamento
   é parte do fluxo, não recuperação de falha.
3. **Nada do usuário sai da máquina dele.** Sem backend, sem API, sem
   telemetria — e o que sai por clipboard já saiu redigido.
4. **Ausência é declarada, nunca preenchida.** Falta número, falta vaga,
   falta cargo-alvo, falta um dos dois documentos: o dossiê diz o que falta
   em vez de inferir por cima.
5. **O prompt é referenciado, nunca copiado.** A lógica de domínio tem um
   único lugar, e o app lê de lá.
