# Evidências de testes

## Fase 01 — execução por blocos (18/11/2026)

Ambiente: Node 22.23.5, npm 10.9.9, runtime temporário já conferido na Fase 00. Nenhuma integração externa faz parte desta execução.

| Bloco | Verificações reais | Resultado |
|---|---|---|
| 0 | `npm test`, `npm run check`, `npm run demo` | 130 testes aprovados, 23 arquivos sem erro de sintaxe, demo com saldo 10 e um movimento |
| 1 | Mesmos três comandos | 141 testes aprovados, 25 arquivos sem erro de sintaxe, demo aprovada |
| 1 | `npm run mutacao`, 42 defeitos em cópias temporárias | Primeira medição: 37 detectados, cinco sobreviventes; os dois sem justificativa motivaram mais testes |
| 1 | `npm run mutacao -- MUT-30` e `-- MUT-40` | Detectados após adicionar rejeição com tentativas negativas e linha completa sem terminador |
| 2 | `npm run typecheck`, `npm test`, `npm run check`, `npm run demo` | Duas configurações de tipos sem erro; 141 testes; sintaxe em 25 arquivos; demo aprovada |
| 3 | Mesmos quatro comandos e regeneração da seed | 169 testes; tipos sem erro; 27 arquivos sem erro de sintaxe; demo aprovada |
| 4 | `npm test`, `npm run check`, `npm run typecheck`, `npm run demo` | 193 testes; tipos sem erro; 29 arquivos sem erro de sintaxe; demo aprovada |
| 5 | Mesmos quatro comandos | 195 testes; tipos sem erro; 29 arquivos sem erro de sintaxe; demo aprovada |
| 6 | Mesmos quatro comandos | 254 testes; tipos sem erro; 30 arquivos sem erro de sintaxe; demo aprovada |
| 7 | Mesmos quatro comandos | 260 testes; tipos sem erro; 31 arquivos sem erro de sintaxe; demo aprovada |
| 8 | Mesmos quatro comandos e regeneração do catálogo | 263 testes; tipos sem erro; 32 arquivos sem erro de sintaxe; demo aprovada |
| 9 | `npm test`, `npm run check`, `npm run typecheck`, `npm run demo` | 267 testes; tipos sem erro; 34 arquivos sem erro de sintaxe; demo aprovada |
| Final | `npm run mutacao` | 42 mutações: 39 detectadas, três equivalentes justificadas (MUT-10, MUT-11 e MUT-37), nenhum alvo ausente ou erro de execução; saída 0 |

A evidência integral da mutação está em [evidencias/mutacao-fase01.txt](evidencias/mutacao-fase01.txt). Os resultados JSON de desempenho estão em [antes](evidencias/desempenho-antes.json) e [depois](evidencias/desempenho-depois.json). As mutações foram atualizadas quando a implementação passou a reproduzir os movimentos diretamente pela ordem do log, mantendo os mesmos defeitos conceituais.

### M-05: medição e leitores concorrentes

Comandos executados: `node local/medir-desempenho.js antes` e `node local/medir-desempenho.js depois`, com o mesmo Node 22.23.5. O script roda também por `npm run medir`. A base é gerada pelo executor em memória e serializada exclusivamente numa pasta temporária, removida ao terminar. Volume inicial de ambas as medições: 90 dias (21/08 a 18/11/2026, fictícios), três movimentos por dia, 40 produtos, seis fornecedores, 270 movimentos, 13 alterações e 658 eventos de log (329 operações confirmadas). Sem vendas. Cada caso teve três aquecimentos e 20 repetições; a entrada medida acrescenta uma unidade com chave nova em cada chamada.

| Caso | Mediana antes (ms) | Mediana depois (ms) | P95 antes/depois (ms) | Leituras antes/depois |
|---|---:|---:|---:|---:|
| Listar produtos | 18,357 | 17,775 | 19,947 / 19,877 | 5 / 5 |
| Consultar estoque | 17,175 | 17,243 | 20,189 / 18,260 | 5 / 5 |
| Consultar reposição | 17,478 | 17,081 | 18,800 / 18,904 | 5 / 5 |
| Registrar entrada | 54,636 | 54,542 | 58,939 / 57,013 | 13 / 13 |

Resultados próximos e sujeitos a ruído: não demonstram ganho expressivo de velocidade. As leituras obrigatórias de confirmação foram mantidas. A reutilização de tabelas evita uma leitura redundante de existência ao reconciliar; a reprodução do saldo passa a usar mapas por SKU, sem varrer movimentos a cada operação. Esses resultados são locais, em JSONL temporário, e não representam cotas ou desempenho do Google.

Antes da mudança, `node --test tests/leituras.test.js` teve três falhas em quatro testes; depois, todos passaram. Foram testadas leitura consistente sem trava, inconsistência transitória corrigida em uma repetição sob trava e inconsistência real ainda devolvida como erro. O teste com processos reais usou quatro leitores (30 consultas cada) e um escritor (20 entradas), pausando 15 ms entre gravação do movimento e confirmação. Nenhum leitor reportou falso erro; o saldo final foi 20. Os testes anteriores de adulteração e corrupção na confirmação continuam aprovados.

Bloco 8: 40 produtos, seis fornecedores e os valores originais dos seis primeiros SKUs fixados por teste. A jornada CLI cobriu todos os comandos novos e repetição de entrada. Um recálculo independente leu os JSONL, filtrou as operações confirmadas e coincidiu com todos os 40 saldos consultados.

Bloco 6: o teste de saldo negativo forjado agora contém uma PERDA bem formada, com assinatura, custo e categoria válidos, e exige mensagem `saldo negativo`. Ele alcança a regra pretendida. Há falhas antes, depois e silenciosas nas três etapas para saldo inicial, perda e ajuste; idempotência e conflito em cada caso; contagens para baixo, para cima e zero; produto inativo; custo histórico após mudança de cadastro. Oito processos tentaram perder duas unidades cada sobre saldo sete: somente três perdas confirmaram e o saldo final ficou em uma unidade.

M-04 substituiu o teste de bloqueio até reconciliação manual por três casos: conclusão automática antes do novo lançamento, falha sem criar intenção nova e validação com o saldo atualizado. O log identifica a conclusão automática. D-017 substitui D-007; o comando manual continua disponível.

M-07: o comando experimental `node node_modules/typescript/lib/tsc.js -p tsconfig.src.json --strict` encontrou 126 erros adicionais. Esse resultado motivou D-027; não é uma checagem aprovada. As configurações versionadas usam `strict: false`, sem suprimir erros.

Mutações equivalentes nesta fundação: MUT-10 (tipo de movimento) e MUT-11 (delta zero) são barradas pela reconstrução canônica da intenção antes da soma; MUT-37 (tipo no conflito) continua barrada pela assinatura dos dados, que difere entre tipos. O executor não ignora alvos ausentes, defeitos sintaticamente inválidos ou erros de execução: esses casos retornam falha. Uma sobrevivente sem justificativa também retorna falha.

O teste antigo de saldo negativo forjado ainda é alcançado pelo tipo PERDA não suportado: será corrigido com a operação PERDA bem formada no Bloco 6. Os dois controles finais do executor receberam testes próprios com repositório de teste que devolve uma operação ainda pendente.

## Registro histórico da Fase 00

**Revisão executada:** 18/11/2026, Linux x86_64, Node.js 22.23.5, npm 10.9.9. **Ambiente exclusivamente local.** Nenhum teste foi executado em Google Sheets, Apps Script ou navegador.

Node/npm não estão no PATH padrão. Foi baixado o arquivo oficial `node-v22.23.5-linux-x64.tar.xz` de `https://nodejs.org/dist/latest-v22.x/`, com SHA-256 comparado ao `SHASUMS256.txt` do mesmo diretório antes de extrair:

```text
cdeb8670a0c81f51b4dc4ac61919f9b1ad917b304bf8221eb939570663d240f8
```

O runtime ficou em `/tmp/merca27-runtime/node-v22.23.5-linux-x64`. Os comandos npm abaixo foram executados com o `bin/` dessa pasta no PATH. Nenhuma ferramenta foi instalada globalmente e nenhuma dependência foi adicionada ao projeto.

## Resultados

| Comando | Resultado |
|---|---|
| `npm test`, antes das alterações | 112 testes, 112 aprovados, 0 falhas |
| `node --test --test-reporter=spec tests/integridade.test.js`, antes das correções | 15 testes novos: 14 falharam reproduzindo lacunas; um já passou |
| Mesmo comando após as primeiras correções | 15 testes, 15 aprovados |
| `npm test`, após todas as alterações de código | 130 testes, 130 aprovados, 0 falhas, 0 cancelados, 0 ignorados |
| `npm run check` | 23 arquivos, 0 erros de sintaxe |
| `npm run demo` | Asserções aprovadas, saldo final 10, recálculo independente 10 e um movimento confirmado |
| `npm run fixtures` e `git diff --exit-code -- fixtures/catalogo-seed.json` | Arquivo regenerado idêntico ao versionado |
| `git diff --check` | Sem erros de espaços em branco |

Os 112 testes originais foram preservados. A suíte completa também executou as jornadas CLI, persistência entre instâncias e os dois testes de concorrência real, cada um com oito processos. A versão final inclui 18 novos testes em `tests/integridade.test.js`.

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
| `tests/integridade.test.js` | Limite da soma de unidades, conteúdo divergente após escrita, validação da intenção e do log, estado final da reconciliação, retorno ambíguo e escrita parcial de bytes |

## Correções verificadas nesta revisão

- Entrada que excederia `Number.MAX_SAFE_INTEGER` é rejeitada sem novo movimento nem intenção; o histórico carregado também precisa ter soma exata.
- Registro relido com mesmo ID e conteúdo diferente impede a confirmação, tanto em operação nova quanto na reconciliação.
- Reconciliação que sofre corrupção ao confirmar retorna erro depois da releitura final.
- Estados desconhecidos e divergências de tipo, requisição, referência ou tentativas no log são recusados antes de novos lançamentos.
- Intenção com tabela imprópria, assinatura divergente ou entrada negativa não é recuperada nem confirmada.
- Erro de retorno depois de uma confirmação persistida não afirma que nada foi gravado. Consulta e repetição mostram a conclusão, sem duplicação.
- Escrita limitada a cinco bytes por chamada produz um JSONL completo, inclusive com caracteres acentuados; escrita sem progresso retorna `FALHA_GRAVACAO`.

O comportamento de bloqueio por pendências continua o mesmo (D-007). M-04, reconciliação automática, não foi implementada nem teve seus testes antecipados.

## Verificação de acesso Google

As buscas `MERCA` e `PULSO` pelo conector Google Drive responderam com listas vazias. Não há ferramenta de execução de Apps Script entre os conectores, `clasp` no PATH, `.clasprc.json` na raiz do usuário nem em `.config/`. Somente a existência desses arquivos foi verificada, sem ler credenciais. Não houve criação, alteração ou execução no Google. Essa checagem não prova ausência de conta Google.

## Testes de mutação

**Registro histórico da entrega anterior (Node.js 24.22.3 / npm 11.19.1); não repetido nesta revisão.** Naquela execução foram relatados 35 defeitos deliberados, um por vez, numa cópia temporária do projeto. **32 foram detectados pela suíte anterior.** Os 3 restantes foram classificados como equivalentes:

| Mutação sobrevivente | Por que não muda o resultado |
|---|---|
| Ignorar a comparação de tipo no conflito | Tipos diferentes já produzem assinaturas diferentes |
| Relaxar a checagem de origem do registro | A comparação canônica rejeita o mesmo registro |
| Remover a checagem de fim de linha do JSONL | A linha cortada falha na interpretação do JSON |

O script de mutação foi ferramenta temporária e não faz parte do repositório.

## Defeito corrigido na entrega anterior

Quando a confirmação era gravada, mas a escrita acusava erro, o sistema anexava um evento depois de `CONFIRMADA` e o log passava a ser recusado como inconsistente. A correção está registrada em D-006 e o caso tem teste próprio.

## Não testado

- Execução real no Apps Script, cotas, `LockService` e comportamento de células do Sheets.
- Versões do Node diferentes da 22.23.5 nesta revisão; a versão 24.22.3 tem somente evidência histórica.
- Volumes grandes de dados.
- Interrupção por queda de energia, reparo automático de arquivos truncados ou alteração coerente de todo o histórico.
- Checagem de tipos: M-07 segue pendente; nenhuma checagem TypeScript foi declarada.
