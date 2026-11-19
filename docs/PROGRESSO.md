# Progresso do A-002 — MERCA 27 / PULSO

Última atualização: 18/11/2026, ao final da Fase 00.

## Implementado e testado localmente

- [x] Modelos de Produto e Movimento com validação independente da interface.
- [x] Catálogo sintético reproduzível com 6 SKUs (`MER-001` a `MER-006`).
- [x] `cadastrarProduto`, `registrarEntrada`, `consultarEstoque`, `listarProdutos` e `reconciliarPendencias`.
- [x] Saldo derivado dos movimentos confirmados.
- [x] Idempotência por `requisicaoId` e rejeição de requisição conflitante.
- [x] Protocolo de gravação com recuperação de falhas parciais.
- [x] Detecção de adulteração dos registros na leitura.
- [x] Armazenamento local somente-acréscimo, trava entre processos e CLI.

## Pendente no Google (nada disto foi executado)

- [ ] Criar a planilha com as abas `PRODUTOS`, `MOVIMENTOS_ESTOQUE` e `OPERACOES_LOG`.
- [ ] Autenticar o `clasp` em conta autorizada e enviar `src/`.
- [ ] Implementar a porta `armazenamento` com `SpreadsheetApp`, incluindo a conversão entre célula vazia e `null` e a gravação de instantes como texto.
- [ ] Implementar a porta `lock` com `LockService`, `relogio` e `gerarId` com `Utilities.getUuid`.
- [ ] Criar menu e sidebar com a identidade visual do PULSO.
- [ ] Repetir o cenário obrigatório no ambiente Google e registrar a evidência.

## Próximas fases (não iniciadas)

- [ ] Fase 1: 40 SKUs, 6 fornecedores, perda, ajuste por contagem, alerta e reposição.
- [ ] Fase 2: vendas com múltiplos itens e estorno.
- [ ] Fase 3: dashboard e automações.
- [ ] Fase 4: refino e case de portfólio.
