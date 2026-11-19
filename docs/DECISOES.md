# Decisões técnicas do A-002

Complementa as ADRs do Documento Mestre. Os documentos-base ficaram inalterados até a v1.1.0 (19/11/2026), quando foram atualizados para refletir o estado real e a decisão D-040.

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

## Planejamento de M-06

- **D-040 — Interface com Angular e Tailwind CSS (19/11/2026):** por decisão do proprietário, a interface de M-06 usará Angular e Tailwind CSS no lugar de HTML/CSS/JS sem framework. Isso supera, para a interface, a orientação do roteiro de não repetir Angular automaticamente. Motivo: interface mais rica e consistente para o case de portfólio. Restrições: o projeto Angular fica isolado em `interface/`, com dependências e lockfile próprios. O núcleo `src/` segue sem build e sem dependências (D-002, D-027). O build final precisa virar um único HTML autocontido servido pelo HTML Service, com roteamento por hash. A interface não reimplementa regras de domínio. Consequências: etapa de build e tamanho de pacote maiores que na alternativa sem framework, além de um script de empacotamento. Os cinco documentos-base foram atualizados para a v1.1.0 com essa decisão (A002-ADR-011 no Documento Mestre).

## M-06 — execução da interface (19/11/2026)

- **D-041 — Versões fixadas da interface:** Angular 22.3.0 (CLI, build, compiler e pacotes de runtime), TypeScript 6.0.3, Tailwind CSS 4.3.5 com `@tailwindcss/postcss` 4.3.5, PostCSS 8.5.33, Vitest 5.1.1, jsdom 31.0.1, RxJS 7.8.2 e tslib 2.9.1, todas exatas (`save-exact`) em `interface/package-lock.json`. O Angular 22 exige TypeScript 6.0; ele fica só em `interface/`, e a raiz mantém TypeScript 5.9.3 (D-027). A aplicação é zoneless (padrão do Angular 22, sem `zone.js`). Em `interface/` valem `strict`, `strictTemplates`, `noUncheckedIndexedAccess` e `noPropertyAccessFromIndexSignature`.

- **D-042 — Binários nativos no vfat:** o volume está montado com `showexec`, que impede executar binários. O pós-instalação do esbuild falhou com `EACCES`. As dependências são instaladas com `npm ci --ignore-scripts`, e `local/interface.js` copia o binário do esbuild da versão instalada (0.28.2) para a pasta temporária do sistema e define `ESBUILD_BINARY_PATH`. Bibliotecas `.node` carregadas pelo Node funcionam normalmente. Nada é instalado globalmente.

- **D-043 — HTML único para o HTML Service:** rotas importadas de forma imediata (sem `loadComponent`), `outputHashing: none`, sem CSS crítico adiado, sem `<base>`, roteamento por hash e fontes do sistema. `local/empacotar-interface.js` embute CSS e JS e recusa chunks extras, `modulepreload`, recursos externos, `media="print"` e conteúdo com `</script`, `</style`, `<!--` ou `<script`. Tamanho atual: 404.363 bytes. O orçamento do build avisa acima de 450 kB e falha acima de 600 kB.

- **D-044 — Despacho e transporte:** `src/application/despacho.js` concentra as 14 ações expostas (consultas, cadastro e alteração de produto, desativação, reativação, entrada, saldo inicial, perda, ajuste e reconciliação). `cadastrarFornecedor` não é exposto, pois a tela de fornecedores é só de leitura. Ação fora da lista retorna `ACAO_DESCONHECIDA`; ação sem pedido recusa dados; exceção inesperada vira `FALHA_INESPERADA`, tratada como incerta. No Apps Script, uma única função `pulsoChamar(acao, pedido)` chamará o despacho. A pré-visualização injeta um `google.script.run` simulado com a mesma forma encadeável, então a interface tem um único transporte. O servidor só ouve em `127.0.0.1`, recusa Host diferente de `127.0.0.1`/`localhost` (proteção contra DNS rebinding), Origin cruzado, corpo acima de 256 KiB e tipo diferente de JSON. Serve a página com CSP `default-src 'none'`, `connect-src 'self'`. Falhas simuladas (`antes` e `depois` de executar) só existem com `--falhas-simuladas`.

- **D-045 — Chave por tentativa lógica:** a chave nasce no primeiro envio e vale até um resultado definitivo. Sucesso encerra a tentativa. Recusa antes de gravar também encerra, exceto se algum envio anterior da mesma chave ficou incerto: nesse caso a chave e os dados incertos são mantidos, e "repetir" reenvia exatamente esses dados. Um novo envio com dados diferentes, depois de falha incerta, usa a mesma chave, para o núcleo responder `REQUISICAO_CONFLITANTE` em vez de duplicar. Classificação dos códigos: recusas conhecidas antes de gravar (`DADOS_INVALIDOS`, `QTD_INVALIDA`, `SKU_INATIVO`, `SALDO_INSUFICIENTE`, `LOCK_OCUPADO` etc.) são "nada gravado"; `REQUISICAO_CONFLITANTE` é conflito; `RECONCILIACAO_PENDENTE` é pendência; qualquer outro código, falha de comunicação depois do envio ou resposta malformada é incerto. Falha antes do envio (sem `google.script.run`) é "nada gravado". Os controles ficam num registro por sessão (`RegistroEnvios`): sair da página não perde a chave, mas recarregar perde. Persistir em armazenamento do navegador foi descartado, pois o iframe do HTML Service tem armazenamento particionado e não garantido.

- **D-046 — Fronteira da validação:** a interface valida apenas formato (preenchido, inteiro, valor em reais) e converte reais em centavos inteiros na fronteira. Regras de negócio continuam só no núcleo, que responde com o próprio erro: quantidade positiva, alvo maior ou igual ao mínimo, saldo suficiente, produto ativo, fornecedor existente. A alteração envia todos os campos alteráveis, e o núcleo calcula o efeito e recusa `ALTERACAO_SEM_MUDANCA`. A marcação "repor" vem de `consultarReposicao`, não de uma regra local. O resumo de diferenças entre versões é só apresentação.

- **D-047 — Navegador indisponível nesta execução:** o Firefox do host (`flatpak-spawn --host`) e o Chromium baixado em `/tmp` foram bloqueados pela política de permissões da sessão, e o CLI do Maestri não existe neste ambiente. Nenhum bloqueio foi contornado. Os critérios de navegador e capturas de M-06 ficam pendentes, e M-06 não é marcada como concluída.

- **D-048 — Google sem acesso efetivo:** o conector Drive exige autorização nesta sessão; não há `clasp` nem ferramenta para executar Apps Script. Adaptadores de Sheets e `LockService`, menu e testes na planilha não foram implementados nem simulados.

- **Correção do executor de mutações:** `tests/contraste.test.js` lê `interface/src/styles.css`. Sem copiar `interface/src` para as cópias temporárias, esse teste falhava em toda mutação e mascarava sobreviventes: a primeira rodada marcou 113 de 113 como detectadas, inclusive as três equivalentes. `local/mutacao.js` passou a copiar `interface/src`, e a evidência válida é a segunda rodada.

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
