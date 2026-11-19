# Decisões técnicas do A-002

Complementa as ADRs do Documento Mestre. Os documentos-base não foram alterados.

| ID | Decisão | Motivo | Consequência |
|---|---|---|---|
| D-001 | Fase 00 local, sem Google | Não há `clasp`, sessão autenticada nem conector Google ativo nesta máquina | Integração continua pendente e não é declarada como concluída |
| D-002 | `src/` escrito como scripts globais (`var PULSO`), sem módulos | O Apps Script não usa `require` nem `import` | Os testes carregam `src/` em contexto isolado, sem APIs do Node e em ordem direta e inversa |
| D-003 | Porta de armazenamento com apenas `ler` e `anexar` | Impede por construção a reescrita do histórico | Mudanças futuras de cadastro exigirão eventos próprios |
| D-004 | Gravação em três passos: `PENDENTE` → dado → `CONFIRMADA` (resolve T-02) | Sheets não tem transação entre abas | Falha parcial é recuperada por repetição idempotente ou reconciliação |
| D-005 | Saldo soma apenas movimentos de operações `CONFIRMADA` | Movimento gravado sem confirmação não pode aparecer como efetivo | A consulta sempre reflete o que foi confirmado |
| D-006 | Nenhum evento é anexado depois da tentativa de confirmação | A confirmação pode ter sido gravada mesmo com erro de retorno. Defeito encontrado pelos testes durante a implementação | A intenção `PENDENTE` basta para recuperar |
| D-007 | Operação pendente bloqueia novos lançamentos (`RECONCILIACAO_PENDENTE`) | O doc. 03, seção 10, pede recuperar a falha antes de novas transações | Disponibilidade menor em troca de consistência |
| D-008 | Requisição rejeitada por validação não consome a chave | Permite corrigir e reenviar | Só operações aceitas participam da idempotência |
| D-009 | Instantes gravados em ISO 8601 UTC e exibidos em `America/Sao_Paulo` (resolve T-05) | Evita ambiguidade de fuso e de locale | O adaptador de Sheets deve gravar como texto |
| D-010 | Texto livre não pode começar com `=`, `+`, `-` ou `@` | Evita interpretação como fórmula na planilha | Regra válida já no domínio |
| D-011 | Trava local por criação exclusiva de arquivo, sem remoção automática | Remover trava alheia poderia permitir escrita simultânea | Após encerramento forçado, a remoção é manual |
| D-012 | Interface da Fase 00 é uma CLI | A interface em Sheets depende de integração indisponível | Identidade visual fica para a etapa com sidebar |
| D-013 | Tabelas locais em JSON Lines com `fsync` | Sem dependências e compatível com acréscimo | Leitura integral a cada operação, adequada ao volume atual |

## Decisões aprovadas e ainda não implementadas

Aprovadas pelo proprietário em 18/11/2026. Escopo e critérios de aceite em [MELHORIAS_PLANEJADAS.md](MELHORIAS_PLANEJADAS.md).

| ID | Melhoria | Decisão | Efeito sobre decisões atuais |
|---|---|---|---|
| D-014 | M-01 | Registrar o custo unitário obrigatório em cada entrada | Prepara a decisão T-03, sem resolvê-la |
| D-015 | M-02 | Alterar produtos por eventos em `PRODUTOS_ALTERACOES`, mantendo a criação imutável | Mantém D-003 |
| D-016 | M-03 | Permitir vários registros por operação antes da Fase 2 | Amplia D-004 |
| D-017 | M-04 | Concluir pendências automaticamente antes de novo lançamento | **Substituirá D-007 quando implementada** |
| D-018 | M-05 | Medir o desempenho e fazer consultas sem trava, com nova tentativa dentro da trava em caso de inconsistência | Reduz o custo apontado em D-013 |
| D-019 | M-06 | Criar interface HTML compatível com Apps Script e pré-visualização local | **Substituirá D-012 como interface principal**; a CLI permanece |
| D-020 | M-07 | Checar tipos com JSDoc e TypeScript apenas em desenvolvimento | Mantém D-002 |

**Stack:** Google Sheets e Apps Script continuam como decisão do MVP. Reavaliar a troca por SQLite ou PostgreSQL somente se houver cliente real, vários operadores simultâneos ou resultado insuficiente nas medições de M-05.

## Acréscimos ao esquema do documento 03

- `PRODUTOS.operacao_id`: liga o cadastro à operação de origem.
- `OPERACOES_LOG.evento_id`, `assinatura` e `payload`: o log passa a ser uma sequência de eventos. A assinatura detecta conflito e o payload permite concluir a operação interrompida.
- Novos códigos de erro: `SKU_INVALIDO`, `SKU_DUPLICADO`, `DADOS_INVALIDOS`, `REQUISICAO_INVALIDA`, `REQUISICAO_CONFLITANTE` e `RECONCILIACAO_PENDENTE`.

## Inconsistências observadas nos documentos

| Tema | Observação | Tratamento |
|---|---|---|
| Conteúdo da Fase 0 | O doc. 01 coloca cadastro e entrada na Fase 1; o doc. 04 e o prompt da execução os colocam na Fase 0 | Seguido o doc. 04 e o prompt |
| Número de documentos | Alguns textos citam quatro arquivos, mas existem cinco | Os cinco foram preservados em `docs/` |
| Limiar de alerta | O doc. 01 admite `<` ou `<=`; o doc. 03 propõe `<=` | Decidir na Fase 1; recomendação: `<=` |

## Decisões ainda abertas

T-01 (sidebar ou formulário), T-03 (método de custo), T-04 (tipo de lock no Apps Script), T-06 (implantação e teste no Google) e T-07 (proteção da planilha).
