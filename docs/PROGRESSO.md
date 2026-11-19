# Progresso do A-002 — MERCA 27 / PULSO

Última atualização: 18/11/2026, Fase 01 concluída localmente na branch `fase-01`.

## Implementado e testado localmente

- [x] Modelos de Produto e Movimento com validação independente da interface.
- [x] Catálogo reproduzível com 40 SKUs e seis fornecedores; valores dos seis primeiros preservados.
- [x] `cadastrarProduto`, `registrarEntrada`, `consultarEstoque`, `listarProdutos` e `reconciliarPendencias`.
- [x] Cadastro e consulta de fornecedores; custo unitário e fornecedor obrigatórios em entradas.
- [x] Alteração, desativação, reativação e histórico de versões de produto.
- [x] Saldo inicial, perda por categoria e ajuste por contagem com saldos anterior e novo.
- [x] Reposição sugerida para produtos ativos com saldo menor ou igual ao mínimo.
- [x] CLI para todos os fluxos, sem regras de negócio na interface.
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
- [x] 267 testes aprovados no Node.js 22.23.5, checagem de tipos e sintaxe válida em 34 arquivos.
- [x] Executor de 42 mutações reproduzíveis em cópias temporárias.
- [x] Medição local de 90 dias sintéticos e testes de leitores concorrentes com gravações.

## Melhorias aprovadas

Detalhes e critérios de aceite em [MELHORIAS_PLANEJADAS.md](MELHORIAS_PLANEJADAS.md).

- [x] M-07: checagem de tipos em `src/` e `local/`, sem build ou APIs Node no núcleo.
- [x] M-01: custo unitário por entrada e fornecedores fictícios com vínculo validado.
- [x] M-02: alteração, desativação, reativação e histórico completo de versões.
- [x] M-04: reconciliação automática antes de novos lançamentos, com releitura e log.
- [x] M-05: projeção em memória por SKU, leituras sem trava, repetição controlada e medição antes/depois.
- [ ] M-06: interface compatível com Apps Script.
- [ ] M-03: operações com vários registros, antes da Fase 2.

## Pendente no Google (nada disto foi executado)

O acesso foi verificado na revisão da Fase 00, sem execução de Apps Script. A Fase 01 exclui integração Google do escopo e não a retestou. Ela continua pendente e depende de autorização efetiva para executar Apps Script; o conector Drive sozinho não basta.

- [ ] Criar a planilha com as abas `PRODUTOS`, `MOVIMENTOS_ESTOQUE` e `OPERACOES_LOG`.
- [ ] Autenticar o `clasp` em conta autorizada e enviar `src/`.
- [ ] Implementar a porta `armazenamento` com `SpreadsheetApp`, incluindo a conversão entre célula vazia e `null` e a gravação de instantes como texto.
- [ ] Implementar a porta `lock` com `LockService`, `relogio` e `gerarId` com `Utilities.getUuid`.
- [ ] Publicar no Apps Script a interface criada em M-06, com menu e identidade visual do PULSO.
- [ ] Repetir o cenário obrigatório no ambiente Google e registrar a evidência.

## Fases

- [x] Fase 1: 40 SKUs, 6 fornecedores, perda, ajuste por contagem, alerta e reposição.
- [ ] Próxima execução: M-06, interface compatível com Apps Script e pré-visualização local; Google somente com acesso efetivo.
- [ ] Fase 2: vendas com múltiplos itens e estorno.
- [ ] Fase 3: dashboard e automações.
- [ ] Fase 4: refino e case de portfólio.
