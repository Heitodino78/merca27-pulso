# Relatório de execução — M-03, operações com vários registros

**Data:** 19/11/2026 · **Branch:** `m03-operacoes` (criada a partir de `interface-angular`) · **Ambiente:** exclusivamente local.

## Resultado

**M-03 está concluída localmente.** Uma operação passa a gravar uma lista de registros com as mesmas garantias de antes: intenção, cada registro com releitura e comparação completa, e confirmação; reconciliação dos registros que faltarem; e recusa de qualquer conjunto incompleto, extra ou divergente. O formato da Fase 01 continua legível sem reescrever nada. O primeiro uso real é a **contagem de inventário com vários SKUs**.

**M-06 continua parcial:** a etapa de navegador não pôde ser feita, porque nenhum caminho foi autorizado nem existe no ambiente (D-054). Google segue sem acesso efetivo. Nada foi publicado, enviado ao remoto ou criado no Google.

## O que mudou

| Área | Mudança |
|---|---|
| Payload | `{ registros: [{ tabela, linha }, ...] }`, de 1 a 200 registros, sem repetição e em ordem fixa. O legado `{ tabela, linha }` é lido como lista de um registro, só para os sete tipos antigos (D-049) |
| `src/infra/repositorio.js` | `lerRegistros` (formatos), `abrirIntencao` com `registros` e `referenciaId`, `conferirIntencao` exige um registro nos tipos antigos, `conferirContagem` novo, `dobrarOperacoes` compara com `referenciaId`, `conferirOrigem` procura a linha na lista da operação, presença exige todos os registros, reprodução percorre a lista e usa o tipo do movimento, `conferirItensContados` novo |
| `src/application/operacoes.js` | `gravarNova` grava a lista; `concluir` grava só o que falta, na ordem da intenção |
| `src/application/casos-de-uso.js` | `construir` devolve listas; respostas leem o primeiro registro; `registrarContagem` novo |
| `src/domain/movimento.js` | `normalizarContagem`: até 100 itens, SKU único, quantidade inteira ≥ 0, itens ordenados por SKU |
| `tipos/contratos.d.ts` | `PedidoContagem`, `RegistroOperacao`, `PayloadIntencao`, `OperacaoPulso`, campos da resposta da contagem |
| CLI | `contagem --item SKU=quantidade ... --motivo "..."` |
| Fixture | `fixtures/base-fase01/`: base JSONL gerada pelo código anterior a M-03, com uma pendência no formato antigo |
| Mutação | 8 alvos reescritos com o mesmo efeito, 21 mutações novas (MUT-114 a MUT-134) e `--verificar-alvos` |

## Contagem de inventário

`pulso.registrarContagem({ requisicaoId, itens: [{ sku, quantidadeContada }], motivo })` grava um `AJUSTE` por SKU com diferença e responde com `ajustados` (saldo anterior, novo e delta) e `semDiferenca`. É tudo ou nada: SKU inexistente, repetido ou inválido, quantidade inválida, lista vazia ou acima de 100 itens, ou nenhuma diferença recusam o pedido inteiro, sem gravar. A mesma contagem enviada em outra ordem é reconhecida como repetição. A ação não foi exposta à interface (D-052).

## Comandos e resultados

Node 22.23.5 e npm 10.9.9 em `/tmp/merca27-runtime` (SHA-256 conferido na execução anterior).

| Comando | Resultado |
|---|---|
| Linha de base antes de alterar | 359 testes, 42 arquivos, tipos, demo, 39 testes de interface, tipos da interface e build aprovados |
| `npm test` | **421 testes, 421 aprovados** (51 em `tests/m03.test.js`, 10 variantes no formato atual dos testes de adulteração e 1 do executor) |
| `npm run check` | 43 arquivos, 0 erros |
| `npm run typecheck` | Duas configurações aprovadas |
| `npm run demo` | Saldo 10, recálculo independente 10 e um movimento |
| `npm run interface:test` | 39 aprovados (interface sem mudanças) |
| `npm run mutacao -- --verificar-alvos` | 134 alvos, cada um encontrado uma única vez |
| `npm run mutacao` | 134 defeitos: **129 detectados e 5 equivalentes justificados** (MUT-10, MUT-11, MUT-37, MUT-115 e MUT-123), saída 0. Evidência em [mutacao-m03.txt](evidencias/mutacao-m03.txt) |
| `npm run interface:mutacao` | 13 defeitos, 13 detectados (interface sem mudanças). Evidência em [mutacao-interface-m03.txt](evidencias/mutacao-interface-m03.txt) |

### Cobertura de `tests/m03.test.js`

- **Compatibilidade:** leitura da base da Fase 01, reconciliação da pendência antiga sem alterar uma linha sequer do log original, gravações novas no formato atual, formato antigo recusado para tipo novo e com chaves extras.
- **Contagem:** um ajuste por SKU com diferença, produto inativo aceito, 16 recusas por inteiro, repetição em outra ordem, conflito e saldo lido dentro da trava.
- **Falhas:** antes, depois e silenciosa em cada uma das três posições da lista. Nunca anuncia sucesso, registros de operação incompleta não entram em saldo, reposição nem listagem, e a repetição conclui sem duplicar. Também falha na confirmação e reconciliação automática antes de novo lançamento.
- **Adulteração:** registro removido, extra, alterado, trocado de operação, repetido, de outra tabela, em ordem invertida, com delta ou contagem forjados, referência divergente, tipo trocado, item com diferença sem ajuste, e operação antiga com dois registros. Os testes de adulteração que já existiam rodam nos formatos legado e atual.
- **Concorrência real:** 12 processos da CLI com contagens e entradas nos mesmos SKUs e uma mesma contagem disparada 4 vezes. O resultado tem saldos iguais ao recálculo dos JSONL, cada ajuste partindo do saldo anterior reproduzido e uma única gravação da contagem repetida.

### Defeito encontrado pelas mutações

Dois testes antigos de executor passaram a acertar pelo motivo errado depois da refatoração: seus repositórios falsos ainda usavam a forma de um registro, quebravam e devolviam o mesmo código esperado. A bateria de mutações revelou isso (MUT-08 e MUT-09 sobrevivendo). Os testes foram corrigidos para a forma nova, passaram a conferir a mensagem, e a bateria foi refeita do zero.

## Desempenho

Mesmo cenário sintético de 90 dias, em JSONL temporário, com a máquina sem outra carga. Evidências: [antes](evidencias/desempenho-m03-antes.json) e [depois](evidencias/desempenho-m03-depois.json).

| Caso | Mediana antes | Mediana depois | Leituras antes/depois |
|---|---:|---:|---:|
| Listar produtos | 17,727 ms | 18,697 ms | 5 / 5 |
| Consultar estoque | 18,001 ms | 18,168 ms | 5 / 5 |
| Consultar reposição | 17,682 ms | 18,653 ms | 5 / 5 |
| Registrar entrada | 54,609 ms | 45,742 ms | 8 / 8 |
| Registrar contagem (5 SKUs) | — | 68,311 ms | — / 12 |

As diferenças nas consultas e na entrada estão dentro do ruído observado nas execuções anteriores, e o número de leituras não mudou. Uma primeira medição "depois" foi descartada por ter rodado junto com a bateria de mutações. Os tempos são locais e não indicam o desempenho no Google.

## Situação do Google

Sem mudança desde D-048: sem `clasp`, sem ferramenta que execute Apps Script e com o conector Drive exigindo autorização. Nada foi implementado nem simulado no Google.

## Limitações

- M-06 sem navegador real e sem capturas (D-047, D-054).
- A contagem não tem tela na interface; existe só no núcleo e na CLI.
- Não há reversão de contagem nem de ajuste; correção continua sendo por novo lançamento (D-031).
- O limite de 200 registros por operação e de 100 itens por contagem é de projeto, não medido no Google.
- Vendas, estorno, dashboard e automações continuam fora; a Fase 2 é a próxima execução.
