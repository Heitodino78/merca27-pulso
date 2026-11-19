# Decisões técnicas do A-002

Complementa as ADRs do Documento Mestre. Os documentos-base não foram alterados.

| ID | Decisão | Motivo | Consequência |
|---|---|---|---|
| D-001 | Fase 00 local, sem execução no Google | Na entrega inicial não havia acesso Google disponível; a revalidação de acesso está em D-022 | Integração operacional continua pendente e não é declarada como concluída |
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

## Decisões aprovadas para as melhorias

Aprovadas pelo proprietário em 18/11/2026. Escopo, critérios de aceite e situação de cada uma em [MELHORIAS_PLANEJADAS.md](MELHORIAS_PLANEJADAS.md).

| ID | Melhoria | Decisão | Efeito sobre decisões atuais |
|---|---|---|---|
| D-014 | M-01 | Registrar o custo unitário obrigatório em cada entrada | Prepara a decisão T-03, sem resolvê-la |
| D-015 | M-02 | Alterar produtos por eventos em `PRODUTOS_ALTERACOES`, mantendo a criação imutável | Mantém D-003 |
| D-016 | M-03 | Permitir vários registros por operação antes da Fase 2 | Amplia D-004 |
| D-017 | M-04 | Concluir pendências automaticamente antes de novo lançamento | **Substituiu D-007 (ver D-030)** |
| D-018 | M-05 | Medir o desempenho e fazer consultas sem trava, com nova tentativa dentro da trava em caso de inconsistência | Reduz o custo apontado em D-013 |
| D-019 | M-06 | Criar interface HTML compatível com Apps Script e pré-visualização local | **Substituirá D-012 como interface principal**; a CLI permanece |
| D-020 | M-07 | Checar tipos com JSDoc e TypeScript apenas em desenvolvimento | Mantém D-002 |

**Stack:** Google Sheets e Apps Script continuam como decisão do MVP. Reavaliar a troca por SQLite ou PostgreSQL somente se houver cliente real, vários operadores simultâneos ou resultado insuficiente nas medições de M-05.

## Revisão da Fase 00 — 18/11/2026

| ID | Decisão | Motivo e consequência | Validação |
|---|---|---|---|
| D-021 | O prompt atual rege a execução: revisar e concluir somente a Fase 00 | Os documentos de continuidade descrevem melhorias aprovadas para a execução seguinte. Mantidas M-01 a M-07 e Fase 1 como pendentes, sem alterar o esquema | Cinco documentos-base e catálogo preservados; 112 testes originais mantidos |
| D-022 | Distinguir conector Drive acessível de execução autorizada em Apps Script | As buscas `MERCA` e `PULSO` responderam sem resultados. Não há ferramenta para executar Apps Script, `clasp` no PATH ou configuração dele nos dois caminhos verificados. Nenhum recurso Google foi alterado; não se conclui que o usuário não tem conta Google | Verificação de ferramentas e buscas realizadas; nenhum teste Google declarado |
| D-023 | Conferir a linha completa após cada escrita, incluindo unicidade da chave | Encontrar apenas o ID não prova que os dados foram gravados corretamente. Um conteúdo divergente impede a etapa de confirmação | Injeção de corrupção em entrada nova e em reconciliação |
| D-024 | Validar a intenção pelas regras do domínio e conferir a sequência completa do log | Estados, tipo, requisição, referência, número de tentativas e assinatura devem ser coerentes; payload só aponta para as duas tabelas de domínio implementadas | Testes de adulteração e recuperação; novos tipos futuros precisarão ampliar explicitamente essa validação |
| D-025 | Rejeitar saldo fora de `Number.MAX_SAFE_INTEGER` e reler após reconciliar | Entradas individualmente válidas podem produzir soma inexata; a reconciliação também precisa comprovar consistência antes de responder | Limite de saldo, histórico incoerente e corrupção durante a confirmação |
| D-026 | Completar escritas parciais em bytes e evitar promessa falsa após retorno ambíguo | `fs.writeSync` pode escrever menos bytes; erro de retorno pode ocorrer depois de uma confirmação persistida | Testes com escrita de cinco bytes por vez, escrita sem progresso e erro posterior à confirmação |

A demonstração passou a usar asserções e recálculo independente do JSONL. Nenhuma dependência foi adicionada. As comparações de intenção e assinatura são verificações de coerência, não proteção criptográfica contra alguém que reescreva todos os arquivos de forma consistente.

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

## Revisão independente da Fase 01

- **D-035 — Valores simples em alterações:** `alterarProduto` aceita apenas texto, número finito, booleano ou nulo. Antes, a serialização transformava `NaN` em nulo e objetos em texto, o que podia remover o fornecedor de um produto sem aviso.
- **D-036 — Ordem do histórico:** a leitura recusa movimento anterior ao cadastro do SKU e entrada em produto que estava inativo naquele momento.
- **D-037 — Respostas coerentes:** toda repetição confirmada recebe `OPERACAO_DUPLICADA`, e falha de leitura em consulta retorna `FALHA_LEITURA`, pois nenhuma gravação foi tentada.
- **D-038 — Leituras da resposta final:** depois de gravar, o executor monta a resposta com as tabelas já lidas na mesma trava. As tabelas gravadas são relidas após cada escrita e as demais não podem mudar enquanto a trava existe. A entrada caiu de 13 para 8 leituras. Complementa D-034; reconciliações continuam relendo todas as tabelas.
- **D-039 — Cobertura de mutação:** as 42 mutações herdadas cobriam quase só regras da Fase 00. Foram acrescentadas 66 mutações para as regras da Fase 01.

## Fase 01

- **D-034 — M-05 no fim da Fase 01:** a medição foi adiada para o esquema final, ainda antes de qualquer integração Google, conforme o prompt desta execução. Consultas leem sem trava e, diante de `DADOS_INCONSISTENTES`, repetem uma única vez dentro da trava. Cada reprodução mantém mapas temporários de saldo e de SKUs movimentados, eliminando buscas repetidas no histórico. `existe` reutiliza a tabela já lida na mesma seção crítica; a releitura final e as verificações após cada escrita continuam consultando a porta. Não há cache persistente de saldo ou de estado validado entre consultas. Os tempos ficaram próximos ao cenário anterior: não há evidência de ganho expressivo nesse volume; não se extrapola o resultado para o Google.

- **D-033 — Catálogo:** 40 SKUs e seis fornecedores; os primeiros seis mantêm nome, preço, custo, mínimo e alvo da Fase 00, fixados por teste. A associação de fornecedor usa índice fixo e não consome o gerador aleatório. A seed cadastra fornecedores antes de produtos e permanece idempotente. A CLI apenas converte argumentos e chama os casos de uso; não calcula delta, saldo ou reposição.

- **D-032 — Reposição:** `ativo && saldo <= estoque_minimo`; sugestão `max(0, estoque_alvo - saldo)`. A consulta retorna só os alertas e identifica a regra, o fornecedor quando cadastrado e a necessidade de revisão humana. Não cria compras, movimentos ou eventos de log.

- **D-031 — Movimentos administrativos:** saldo inicial só é aceito sem movimentos anteriores; repetir a mesma chave continua idempotente, enquanto uma nova chave após movimentação retorna `SALDO_INICIAL_INDEVIDO`. Perdas e ajustes aceitam produto inativo, pois representam o estoque físico. Custo da perda/ajuste é o custo de referência vigente, preservado no movimento. A reprodução das operações segue a ordem do log para validar cada custo e versão, sem comparar o histórico com o cadastro final. Ajuste registra saldos anterior e novo, calculados dentro da trava. Reversões compensatórias de perdas e ajustes ficam explicitamente adiadas para a Fase 2, junto do estorno; não há edição nem exclusão para corrigir histórico nesta fase.

- **D-030 — M-04:** D-017 passa a substituir D-007. Pendências são concluídas automaticamente, em ordem, dentro da mesma trava, antes de verificar um lançamento novo. O estado é recarregado após concluir; falha retorna `RECONCILIACAO_PENDENTE` e não inicia a nova intenção. Conflito de uma requisição já existente continua sendo rejeitado sem recuperar dados conflitantes. A reconciliação manual permanece disponível.

- **D-029 — M-02:** criação de produto imutável e alterações em `PRODUTOS_ALTERACOES`. A assinatura conserva o pedido normalizado completo; `campos_json` guarda somente mudanças efetivas em ordem canônica. Isso permite repetir um pedido que inclua campos sem mudança sem perder idempotência. Na leitura, o estado inteiro é validado em cada versão e o efeito é confrontado com a intenção original. Desativar e reativar usam o mesmo tipo auditável de alteração, com o campo `ativo` obrigatório nesses atalhos. SKU e unidade não podem mudar.

- **D-028 — M-01 e fornecedores:** movimentos ganham, ao final, custo unitário, fornecedor, categoria de perda e saldos de ajuste, exatamente na ordem do prompt. Entrada exige custo e fornecedor existente e ativo. O fornecedor opcional do produto deve existir. A seed passa a cadastrar seis fornecedores antes dos seis produtos atuais; a expansão fica no Bloco 8. Nenhum dado existente foi apagado: bases da Fase 00 têm formato incompatível e devem ser preservadas como arquivo histórico, usando outro `PULSO_DADOS` para a Fase 01. Não há migração automática nem descarte silencioso de colunas antigas. A comparação canônica e a validação da intenção foram ampliadas, sem retirar verificações.

- **D-027 — M-07:** contratos JSDoc e declarações em `tipos/`; fábricas nomeadas resolvem a inferência circular de `PULSO` sem API do Node em `src/`. TypeScript 5.9.3 e tipos Node 22.20.5 são dependências de desenvolvimento, com lockfile. `src` usa lib ES2020 e `types: []`; a configuração local usa NodeNext e ES2022 (para `Object.hasOwn`). `moduleDetection: legacy` preserva os scripts globais. As duas checagens passam. `strict` foi avaliado e produziu 126 erros adicionais no núcleo, sobretudo parâmetros implícitos em callbacks e registros dinâmicos. Nesta etapa mantém-se `strict: false`, sem `@ts-ignore` ou `@ts-nocheck`; as regras de runtime permanecem obrigatórias. A evolução para strict exige tipar todo o executor e suas respostas discriminadas, sem atalhos por `any` global.
