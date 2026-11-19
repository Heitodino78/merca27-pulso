# Progresso do A-002 — MERCA 27 / PULSO

Última atualização: 18/11/2026, revisão da Fase 00. A execução atual preservou o escopo de cadastro → entrada → saldo.

## Implementado e testado localmente

- [x] Modelos de Produto e Movimento com validação independente da interface.
- [x] Catálogo sintético reproduzível com 6 SKUs (`MER-001` a `MER-006`).
- [x] `cadastrarProduto`, `registrarEntrada`, `consultarEstoque`, `listarProdutos` e `reconciliarPendencias`.
- [x] Saldo derivado dos movimentos confirmados.
- [x] Idempotência por `requisicaoId` e rejeição de requisição conflitante.
- [x] Protocolo de gravação com recuperação de falhas parciais.
- [x] Detecção de adulteração dos registros na leitura.
- [x] Armazenamento local somente-acréscimo, trava entre processos e CLI.
- [x] Comparação integral dos dados após cada escrita e validação dos eventos do log.
- [x] Intenções recuperáveis validadas pelas regras do domínio.
- [x] Proteção contra saldo acima do limite de inteiros exatos.
- [x] Verificação do estado final da reconciliação e tratamento de retorno ambíguo.
- [x] Escrita parcial de bytes tratada no adaptador JSONL.
- [x] Demonstração com asserções e recálculo independente; guia da seed em `fixtures/SEED_README.md`.
- [x] 130 testes aprovados no Node.js 22.23.5 e sintaxe válida em 23 arquivos.

## Melhorias aprovadas (nenhuma implementada)

Detalhes e critérios de aceite em [MELHORIAS_PLANEJADAS.md](MELHORIAS_PLANEJADAS.md).

- [x] M-07: checagem de tipos em `src/` e `local/`, sem build ou APIs Node no núcleo.
- [x] M-01: custo unitário por entrada e fornecedores fictícios com vínculo validado.
- [x] M-02: alteração, desativação, reativação e histórico completo de versões.
- [x] M-04: reconciliação automática antes de novos lançamentos, com releitura e log.
- [ ] M-05: desempenho e leituras sem trava.
- [ ] M-06: interface compatível com Apps Script.
- [ ] M-03: operações com vários registros, antes da Fase 2.

## Pendente no Google (nada disto foi executado)

O conector Google Drive foi consultado nesta revisão e respondeu sem arquivos MERCA/PULSO. Não há execução de Apps Script disponível pelos conectores nem `clasp`/configuração local nos caminhos verificados. Essa consulta não equivale a integração operacional nem demonstra ausência de conta Google.

- [ ] Criar a planilha com as abas `PRODUTOS`, `MOVIMENTOS_ESTOQUE` e `OPERACOES_LOG`.
- [ ] Autenticar o `clasp` em conta autorizada e enviar `src/`.
- [ ] Implementar a porta `armazenamento` com `SpreadsheetApp`, incluindo a conversão entre célula vazia e `null` e a gravação de instantes como texto.
- [ ] Implementar a porta `lock` com `LockService`, `relogio` e `gerarId` com `Utilities.getUuid`.
- [ ] Publicar no Apps Script a interface criada em M-06, com menu e identidade visual do PULSO.
- [ ] Repetir o cenário obrigatório no ambiente Google e registrar a evidência.

## Próximas fases (não iniciadas)

- [ ] Fase 1: 40 SKUs, 6 fornecedores, perda, ajuste por contagem, alerta e reposição.
- [ ] Fase 2: vendas com múltiplos itens e estorno.
- [ ] Fase 3: dashboard e automações.
- [ ] Fase 4: refino e case de portfólio.
