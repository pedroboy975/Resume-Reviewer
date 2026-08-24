# Teste com usuários

Roteiro para a única verificação que o `PRODUCT.md` marca como pendente:
**colar o dossiê num chat de IA dá resultado melhor do que colar o PDF cru?**

Enquanto essa pergunta não tiver resposta em pelo menos 5 pessoas, nenhuma
feature nova entra. Pedido de feature que surgir no teste vai para a seção
"Pedidos" no fim deste arquivo, não para o `ROADMAP.md`.

---

## Antes de começar

- [ ] A pessoa abre a página **no aparelho dela**. Você não recebe o PDF.
- [ ] Se algo quebrar, peça print da tela — **nunca** o arquivo.
- [ ] Nenhum PDF de teste vai para `tests/fixtures/`. Os 6 que estão lá já
      contêm dados não anonimizados; não aumente essa superfície.
- [ ] Você fica calado. Só intervém se a pessoa travar por mais de 1 minuto,
      e aí **anota que precisou intervir**.

## Durante — o que observar (não o que perguntar)

### Extração
- Em que ponto o texto saiu fora de ordem? (layout de duas colunas, tabela,
  cabeçalho repetido)
- A timeline mostrou **cargo e empresa** corretos? Onde errou?
- Lacunas e permanências curtas: confira uma a uma contra o que a pessoa
  conta. Estar presente não basta, tem que estar **certo**.

### Fatiamento em seções
O `PRODUCT.md` (princípio 2) diz que corrigir seção é parte do fluxo, não
recuperação de falha. Então o que se mede não é se errou, é:
- [ ] A pessoa **percebeu sozinha** que dava para corrigir?
- [ ] Ela entendeu o que "seção" significa sem explicação?

Se precisou explicar, o problema é de interface. Ajustar o parser não resolve.

### Fase 3 — perguntas de métrica
- Quantos campos ficaram **em branco**?
- Se a maioria pulou: a decisão não é melhorar o detector de métricas, é
  decidir se a pergunta é respondível naquele momento.

### PII
- [ ] Algum dado pessoal reapareceu em alguma tela ou no dossiê final?
      Isso é bug bloqueante, para o teste e anota.

## O teste comparativo — o que de fato importa

No mesmo chat de IA, mesma pergunta ("analise minha carreira"):

| | Entrada |
|---|---|
| **A** | o PDF cru |
| **B** | o dossiê |

Ordem alternada entre pessoas, e sem dizer qual é qual. Depois:

- Qual das duas respostas você levaria a sério?
- Alguma das duas errou alguma data, duração ou tempo de casa?

A segunda pergunta é a que testa o Positioning: a promessa é que o chat com
o PDF cru refaz a aritmética de cabeça e erra, e o dossiê chega com ela
pronta. Se isso não aparecer nos testes, o posicionamento é falso.

---

## Registro

Uma linha por pessoa.

| # | Nível | Tipo | Aparelho / navegador | Parser errou onde | Corrigiu sozinho? | Métricas em branco | Interveio? | Dossiê > PDF? |
|---|-------|------|----------------------|-------------------|-------------------|--------------------|------------|---------------|
| 1 |       |      |                      |                   |                   |                    |            |               |
| 2 |       |      |                      |                   |                   |                    |            |               |
| 3 |       |      |                      |                   |                   |                    |            |               |
| 4 |       |      |                      |                   |                   |                    |            |               |
| 5 |       |      |                      |                   |                   |                    |            |               |

- **Nível**: Júnior · Pleno · Sênior · Especialista · Gestor · Diretor
- **Tipo**: CV · LinkedIn · ambos
- **Dossiê > PDF?**: sim · empate · não

### O que esperar por nível

| Nível | Hipótese | O que confirma ou derruba |
|---|---|---|
| Júnior | 1–2 períodos, zero lacunas, poucos bullets — o dossiê sai quase vazio de achados | Se não sobra valor, o app só serve para quem já tem carreira. É achado de produto, não bug. |
| Pleno / Sênior | Caso central: lacuna e permanência curta aparecem de verdade | Estão **corretas**? |
| Gestor / Diretor | Carreira longa, vários cargos na mesma empresa | É onde a herança de empresa (`stickyCompany` em `src/lib/companies.ts`) quebra primeiro |

### Cobertura mínima antes de seguir

- [ ] Pelo menos um Júnior e um Gestor/Diretor
- [ ] Pelo menos um export de LinkedIn e um currículo próprio
- [ ] Pelo menos um **iPhone / Safari** — nunca foi testado, e é o caminho
      mais provável de alguém abrir um link compartilhado
- [ ] Pelo menos um upload de PDF real **na página publicada**, não em
      `localhost`: o worker do `pdfjs` sob `basePath` é o único ponto que a
      verificação por HTTP não cobriu

---

## Decisão

Depois de 5 pessoas:

| Resultado | Próximo passo |
|---|---|
| Ganhou na maioria | Polir o que existe. As falhas de parser anotadas viram a fila. |
| Empatou | Nenhuma feature nova salva. O problema está no **conteúdo** do dossiê. |
| Perdeu | Reabrir a premissa antes de escrever qualquer código. |

## Pedidos

Feature que a pessoa pediu, com quem pediu e o problema por trás. Pedido não
é tarefa até passar pela decisão acima.

-
