# Evidências de testes

## M-06 — interface Angular + Tailwind (19/11/2026)

Esta seção traz o estado atual. Ambiente local, Node 22.23.5 e npm 10.9.9 em `/tmp/merca27-runtime` (SHA-256 conferido). **Nada foi executado em navegador real, Google Sheets ou Apps Script** (D-047, D-048).

| Verificação | Resultado |
|---|---|
| Linha de base antes de alterar | 343 testes, 35 arquivos, tipos e demo aprovados |
| `npm test` | 359 testes, 359 aprovados, 0 falhas |
| `npm run check` | 42 arquivos, 0 erros de sintaxe |
| `npm run typecheck` | Duas configurações aprovadas |
| `npm run demo` | Saldo final 10, recálculo independente 10 e um movimento |
| `npm run interface:typecheck` | Aprovado com TypeScript strict e `strictTemplates` |
| `npm run interface:test` | 39 testes em 5 arquivos, todos aprovados (Vitest 5.1.1 + jsdom) |
| `npm run interface:build` | HTML único com 404.363 bytes, sem chunks nem referências externas |
| `npm run interface:mutacao` | 13 defeitos, 13 detectados por falha de teste. Evidência em [evidencias/mutacao-interface.txt](evidencias/mutacao-interface.txt) |
| `npm run mutacao` | 113 defeitos (108 anteriores e 5 do despacho): 110 detectados e 3 equivalentes justificados (MUT-10, MUT-11 e MUT-37), saída 0. Evidência em [evidencias/mutacao-m06.txt](evidencias/mutacao-m06.txt). Uma primeira rodada, descartada, marcou 113/113 por causa do teste de contraste sem `interface/src` na cópia |
| Fumaça HTTP da pré-visualização (build real, seed, pasta temporária) | `GET /` 200 com shim e CSP; 40 produtos; entrada 10; repetição `OPERACAO_DUPLICADA` com saldo 10 |

### Testes novos

- `tests/interface-local.test.js` (13): ações expostas e recusadas pelo despacho (inclusive `constructor` e `__proto__`), pedido obrigatório ou proibido, idempotência e conflito repassados, exceção virando falha incerta; servidor só em `127.0.0.1`, shim no início do `<head>`, CSP, Host e Origin recusados, 415, 400, 413, falhas simuladas antes e depois de executar e repetição sem duplicar; empacotamento e suas recusas.
- `tests/contraste.test.js` (3): paleta preservada, 17 pares de texto e fundo com contraste AA (mínimo medido 6,36:1) e âmbar nunca usado como cor de texto.
- `interface/src/app/**/*.spec.ts` (39): conversão de reais para centavos (inclusive formatos ambíguos recusados), chave por tentativa lógica, clique duplo, sucesso só após confirmação, repetição com a mesma chave e os mesmos dados, conflito, recusa depois de falha incerta, classificação dos códigos, transporte `google.script.run`, rótulos e mensagens associadas, foco, estados vazio, carregando e falha, histórico, versões, produto inativo e reconciliação pendente.

### Defeitos encontrados durante a execução

| Defeito | Correção |
|---|---|
| Uma recusa de validação depois de uma falha incerta descartava a chave; o próximo envio ganharia chave nova e poderia duplicar o lançamento incerto | Chave e dados incertos mantidos; repetir reenvia os dados incertos (D-045). Cobertos por teste e por MUI-03 e MUI-04 |
| O teste de contraste falhava em toda cópia de mutação, mascarando sobreviventes | `local/mutacao.js` copia `interface/src` (D-048, correção do executor) |

### Não testado

- Navegador real nas larguras 360, 390, 768 e 1440 px, capturas, foco visível e teclado de ponta a ponta (D-047).
- HTML Service real: módulo ES embutido, `crypto.randomUUID` no iframe e limites de tamanho.
- Qualquer operação em Google Sheets ou Apps Script.


## Revisão independente da Fase 01 (18/11/2026)

Esta seção traz o estado atual. As seções seguintes registram o histórico de cada entrega. Ambiente exclusivamente local: nada foi executado em Google Sheets, Apps Script ou interface visual.

| Verificação | Resultado |
|---|---|
| `npm test` no Node 22.23.5 e no Node 24.22.3 | 343 testes, 343 aprovados, 0 falhas |
| `npm run check` | 35 arquivos, 0 erros de sintaxe |
| `npm run typecheck` | Duas configurações aprovadas |
| `npm run demo` | Saldo final 10, recálculo independente 10 e um movimento |
| `npm run mutacao` | 108 defeitos: 105 detectados e 3 equivalentes justificados (MUT-10, MUT-11 e MUT-37) |

A evidência completa está em [evidencias/mutacao-fase01.txt](evidencias/mutacao-fase01.txt).

### Defeitos encontrados na revisão

| Defeito | Correção |
|---|---|
| `alterarProduto` aceitava `NaN`, `Infinity` e objetos, convertendo-os na serialização. `fornecedorId: NaN` removia o fornecedor do produto | Só valores simples são aceitos (D-035) |
| A leitura aceitava movimento anterior ao cadastro do SKU e entrada em produto inativo naquele momento | Ordem validada ao reproduzir o histórico (D-036) |
| Só a entrada avisava `OPERACAO_DUPLICADA`, e repetir fornecedor ou alteração respondia como operação nova | Aviso único e mensagens corretas (D-037) |
| Falha de leitura em consulta aparecia como `FALHA_GRAVACAO` | Novo código `FALHA_LEITURA` (D-037) |
| M-05 estava marcada como concluída, mas a entrada continuava com 13 leituras | Resposta final reaproveita as leituras da mesma trava (D-038) |
| A CLI não mostrava o histórico de versões e aceitava palavra solta como opção | Comando `historico-produto` e validação das opções |
| As 42 mutações quase não cobriam as regras da Fase 01 | 66 mutações novas e 76 testes novos em `tests/revisao-fase01.test.js` (D-039) |

### Desempenho

Mesmo cenário sintético da Fase 01: 90 dias, 270 movimentos e 658 eventos de log, em JSONL temporário.

| Caso | Mediana na entrega do Codex | Mediana na revisão | Leituras antes/depois |
|---|---:|---:|---:|
| Listar produtos | 17,775 ms | 17,679 ms | 5 / 5 |
| Consultar estoque | 17,243 ms | 17,126 ms | 5 / 5 |
| Consultar reposição | 17,081 ms | 17,517 ms | 5 / 5 |
| Registrar entrada | 54,542 ms | 50,180 ms | 13 / 8 |

O ganho real está na entrada, com 5 leituras a menos por operação. As diferenças nas consultas estão dentro do ruído. Os valores são locais e não indicam o desempenho no Google. Dados completos em [evidencias/desempenho-revisao.json](evidencias/desempenho-revisao.json).

### Não testado até agora

- Execução real no Apps Script, cotas, `LockService` e comportamento de células do Sheets.
- Volumes acima do cenário de 90 dias.
- Queda de energia durante a escrita e reparo automático de arquivo truncado.
- Alteração coerente de todo o histórico, pois não há proteção criptográfica.
- Modo `strict` do TypeScript, mantido desativado (D-027).

## Fase 01 — entrega original, execução por blocos (18/11/2026)

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

Os dois controles finais do executor receberam testes próprios com repositório de teste que devolve uma operação ainda pendente.

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

Naquela revisão, o bloqueio por pendências seguia D-007. A reconciliação automática (M-04) foi implementada depois, na Fase 01.

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

## Não testado na Fase 00

Lista histórica. A situação atual está em "Não testado até agora", na revisão da Fase 01.

- Execução real no Apps Script, cotas, `LockService` e comportamento de células do Sheets.
- Volumes grandes de dados.
- Interrupção por queda de energia, reparo automático de arquivos truncados ou alteração coerente de todo o histórico.
