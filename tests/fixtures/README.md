# Fixtures

Currículos e perfis reais usados como base de teste. **Não versionados** —
são documentos de pessoas identificáveis, com PII não anonimizada.
Ver `/.gitignore`.

Quem clonar este repo precisa colocar aqui os próprios PDFs antes de
rodar os testes. O contrato mínimo, checado por `tests/fixtures.test.ts`:

- pelo menos 5 PDFs
- pelo menos um currículo de coluna única
- pelo menos um currículo de duas colunas (é onde `pdfjs` erra a ordem de leitura)
- pelo menos um export de perfil do LinkedIn (`Profile.pdf`)

Conjunto atual na máquina do autor: 4 currículos + 2 exports de LinkedIn.
