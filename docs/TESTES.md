# Evidências de testes

**Execução:** 18/11/2026, Linux x86_64, Node.js 24.22.3, npm 11.19.1. **Ambiente exclusivamente local.** Nenhum teste foi executado em Google Sheets, Apps Script ou navegador.

## Resultados

| Comando | Resultado |
|---|---|
| `npm run check` | 22 arquivos, 0 erros de sintaxe |
| `npm test` (3 execuções seguidas) | 112 testes, 112 aprovados, 0 falhas, 0 ignorados |
| `npm run demo` | Saldo final 10 e 1 movimento confirmado |
| Jornada manual pela CLI | `seed`, `produtos`, `entrada`, repetição, entrada inválida e `saldo` com o resultado esperado |

## Cenário obrigatório

| # | Cenário | Esperado | Obtido |
|---|---|---|---|
| — | Estado inicial de `MER-001` | Saldo 0 | Aprovado |
| 1 | Entrada válida de 10 | Saldo 10, um movimento | Aprovado |
| 2 | Mesma requisição repetida | Saldo 10, sem novo movimento | Aprovado |
| 3 | Quantidade -5 | `QTD_INVALIDA`, saldo 10 | Aprovado |
| 4 | SKU inexistente | `SKU_INEXISTENTE`, histórico intacto | Aprovado |
| 5 | Quantidade 2,5 | `QTD_INVALIDA` | Aprovado |
| 6 | Recálculo independente do saldo | Igual à consulta | Aprovado |
| 7 | Falha de armazenamento | `FALHA_GRAVACAO`, sem sucesso falso | Aprovado |

## Cobertura adicional

| Arquivo | Conteúdo |
|---|---|
| `tests/dominio.test.js` | Quantidades, SKUs, requisições e cadastros inválidos; valores-limite |
| `tests/fluxo.test.js` | Cenário obrigatório, conflito, produto inativo, SKU duplicado, consulta e log |
| `tests/falhas.test.js` | Falha em cada etapa da gravação, reconciliação e 12 formas de adulteração |
| `tests/local.test.js` | Portabilidade do núcleo, catálogo, persistência, trava, concorrência real com 8 processos e CLI |

## Testes de mutação

Foram introduzidos 35 defeitos deliberados, um por vez, numa cópia temporária do projeto. **32 foram detectados pela suíte.** Os 3 restantes não alteram o comportamento, porque outra verificação barra o mesmo caso:

| Mutação sobrevivente | Por que não muda o resultado |
|---|---|
| Ignorar a comparação de tipo no conflito | Tipos diferentes já produzem assinaturas diferentes |
| Relaxar a checagem de origem do registro | A comparação canônica rejeita o mesmo registro |
| Remover a checagem de fim de linha do JSONL | A linha cortada falha na interpretação do JSON |

O script de mutação foi ferramenta temporária e não faz parte do repositório.

## Defeito encontrado e corrigido

Quando a confirmação era gravada, mas a escrita acusava erro, o sistema anexava um evento depois de `CONFIRMADA` e o log passava a ser recusado como inconsistente. A correção está registrada em D-006 e o caso tem teste próprio.

## Não testado

- Execução real no Apps Script, cotas, `LockService` e comportamento de células do Sheets.
- Versões do Node diferentes da 24.22.3.
- Volumes grandes de dados.
