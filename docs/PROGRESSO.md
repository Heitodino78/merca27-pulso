# Progresso do A-002 — MERCA 27 / PULSO

Última atualização: 19/11/2026. Fase 3 (indicadores e visão geral) na branch `fase-03-dashboard`; M-06 continua sem verificação em navegador real. Relatório atual: [RELATORIO_FASE_03.md](RELATORIO_FASE_03.md).

## Implementado e testado localmente

- [x] Modelos de Produto e Movimento com validação independente da interface.
- [x] Catálogo reproduzível com 40 SKUs e seis fornecedores; valores dos seis primeiros preservados.
- [x] `cadastrarProduto`, `registrarEntrada`, `consultarEstoque`, `listarProdutos` e `reconciliarPendencias`.
- [x] Cadastro e consulta de fornecedores; custo unitário e fornecedor obrigatórios em entradas.
- [x] Alteração, desativação, reativação e histórico de versões de produto.
- [x] Saldo inicial, perda por categoria e ajuste por contagem com saldos anterior e novo.
- [x] Reposição sugerida para produtos ativos com saldo menor ou igual ao mínimo.
- [x] Vendas de 1–50 itens, validação integral, valores históricos e baixa idempotente.
- [x] Histórico/detalhe de venda e estorno total único com movimentos compensatórios.
- [x] CLI e interface Angular para vendas, revisão, confirmação e estorno.
- [x] CLI para todos os fluxos, sem regras de negócio na interface.
- [x] Indicadores por período (D-063 a D-065): vendas brutas, devoluções pela data do estorno, receita após devoluções, CMV e margem estimados, ticket, perdas por categoria, ajustes, entradas, série diária, ranking e estoque atual, com fórmulas e IDs de origem.
- [x] Visão geral na interface: períodos, KPIs animados, gráfico SVG com teclado e tabela, ranking, reposição e perdas; menu lateral, gaveta no celular e paleta Ctrl+K.
- [x] Resumo diário sob demanda (consulta e CLI), reconciliável com os indicadores; sem agenda, persistência nem envio (D-066).
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
- [x] 548 testes do núcleo e 74 da interface aprovados, checagem de tipos e sintaxe válida em 49 arquivos.
- [x] Executores de mutação em cópias: 179 alvos no núcleo e 37 na interface. Resultados em TESTES.md.
- [x] Medição local de 90 dias sintéticos e testes de leitores concorrentes com gravações.

## Melhorias aprovadas

Detalhes e critérios de aceite em [MELHORIAS_PLANEJADAS.md](MELHORIAS_PLANEJADAS.md).

- [x] M-07: checagem de tipos em `src/` e `local/`, sem build ou APIs Node no núcleo.
- [x] M-01: custo unitário por entrada e fornecedores fictícios com vínculo validado.
- [x] M-02: alteração, desativação, reativação e histórico completo de versões.
- [x] M-04: reconciliação automática antes de novos lançamentos, com releitura e log.
- [x] M-05: projeção em memória por SKU, leituras sem trava, repetição controlada e medição. Desde a Fase 2, oito tabelas exigem 8 leituras por consulta e 11 por entrada; conferências pós-escrita mantidas (D-060).
- [ ] M-06: interface Angular + Tailwind compatível com Apps Script. **Parcial:** telas de estoque e vendas, estados, chave por tentativa, HTML único de 434.763 bytes, pré-visualização local e 51 testes de interface. **Falta:** verificação em navegador real e capturas (D-061). Detalhes em [RELATORIO_INTERFACE.md](RELATORIO_INTERFACE.md).
- [x] M-03: operações com vários registros, formato antigo legível, contagem de inventário com vários SKUs, 51 testes e 21 mutações novas. Detalhes em [RELATORIO_M03.md](RELATORIO_M03.md).

## Pendente no Google (nada disto foi executado)

O acesso foi verificado na revisão da Fase 00, sem execução de Apps Script. A Fase 01 exclui integração Google do escopo e não a retestou. Ela continua pendente e depende de autorização efetiva para executar Apps Script; o conector Drive sozinho não basta.

- [ ] Criar a planilha com as oito tabelas atuais de `src/infra/esquema.js`.
- [ ] Autenticar o `clasp` em conta autorizada e enviar `src/`.
- [ ] Implementar a porta `armazenamento` com `SpreadsheetApp`, incluindo a conversão entre célula vazia e `null` e a gravação de instantes como texto.
- [ ] Implementar a porta `lock` com `LockService`, `relogio` e `gerarId` com `Utilities.getUuid`.
- [ ] Publicar no Apps Script o HTML único de M-06 (`interface/dist/html-service/Interface.html`) com menu e uma função `pulsoChamar` que chame `PULSO.despacho.despachar`.
- [ ] Repetir o cenário obrigatório no ambiente Google e registrar a evidência.

## Fases

- [x] Fase 1: 40 SKUs, 6 fornecedores, perda, ajuste por contagem, alerta e reposição.
- [x] Fase 3, parte local: indicadores, visão geral e resumo diário sob demanda.
- [ ] Fase 3, restante: execução programada do resumo com log de tentativas e porta de entrega falsa (D-066).
- [ ] Próxima execução: ver `PROMPT_PROXIMA_EXECUCAO.md`. Concluir M-06 no navegador quando autorizado; Google somente com acesso efetivo.
- [x] Fase 2 local: vendas com múltiplos itens, histórico, estorno total, CLI e interface. M-06/navegador e Google continuam pendentes.
- [ ] Reversão de perdas, ajustes e contagens: fatia própria ainda adiada (D-058).
- [ ] Fase 4: refino e case de portfólio.
