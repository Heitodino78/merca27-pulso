# Prompt para a próxima execução — PULSO

Estado de referência: M-06 implementada e testada localmente em 19/11/2026 na branch `interface-angular` (criada a partir de `fase-01`), ainda sem verificação em navegador real. Este arquivo descreve a execução seguinte; ainda não foi executado.

**Antes de iniciar a sessão (ação do proprietário):** a verificação em navegador da execução anterior foi bloqueada pela política de permissões (D-047). Para concluir M-06, autorize um destes caminhos: executar o Firefox do sistema via `flatpak-spawn --host`, executar um Chromium baixado em `/tmp`, ou abrir a sessão dentro do Maestri com o CLI `maestri` disponível. Sem isso, a etapa 4 termina registrada como impossível e a execução segue para M-03.

```text
# MERCA 27 — PULSO — CONCLUIR M-06 NO NAVEGADOR E IMPLEMENTAR M-03 (VÁRIOS REGISTROS POR OPERAÇÃO)

Você é o engenheiro responsável pelo PULSO, sistema de gestão de um mercado inteiramente fictício. Trabalhe diretamente nos arquivos, teste e documente. Apresente um plano curto e execute sem esperar confirmação para decisões técnicas rotineiras.

## 1. LEITURA OBRIGATÓRIA

Leia integralmente:
- docs/RELATORIO_INTERFACE.md, docs/PROGRESSO.md, docs/DECISOES.md (especialmente D-002, D-007, D-017, D-027, D-029, D-030, D-031 e D-040 a D-048) e docs/TESTES.md.
- docs/MELHORIAS_PLANEJADAS.md, especialmente M-06 e M-03.
- Os cinco documentos-base (v1.1.0), de docs/00_COMECE_AQUI.md a docs/04_ROTEIRO_EXECUCAO_E_PROMPT.md. Não os altere; registre divergências em docs/DECISOES.md.
- README.md, interface/README.md, fixtures/SEED_README.md e todo o código em src/, local/, tipos/, tests/ e interface/src/.

Confirme o estado real pelo código e pelos comandos. Em caso de divergência, o código e os testes executados prevalecem sobre este prompt.

## 2. ESTADO REAL

- Branch interface-angular, com commits locais por fatia; sem merge em main, remoto ou publicação.
- Núcleo src/ em scripts globais var PULSO, sem build e sem APIs do Node (D-002, D-027). Portas: armazenamento { ler, anexar }, lock { executar }, relogio e gerarId.
- Protocolo de escrita: intenção PENDENTE -> dado -> CONFIRMADA, com releitura e comparação completa após cada gravação, idempotência por requisicaoId, REQUISICAO_CONFLITANTE e reconciliação automática antes de novo lançamento (D-030). Saldo sempre derivado.
- Cada operação ainda grava UM registro: o payload da intenção é { tabela, linha }.
- Tabelas: FORNECEDORES, PRODUTOS, PRODUTOS_ALTERACOES, MOVIMENTOS_ESTOQUE e OPERACOES_LOG. Tipos de operação: CADASTRO_FORNECEDOR, CADASTRO_PRODUTO, ALTERACAO_PRODUTO, ENTRADA, SALDO_INICIAL, PERDA e AJUSTE.
- src/application/despacho.js expõe 14 ações à interface (D-044); cadastrarFornecedor fica fora.
- Interface em interface/: Angular 22.3.0 zoneless, TypeScript 6.0.3 strict, Tailwind CSS 4.3.5, versões exatas (D-041). Rotas por hash e sem carregamento tardio; o build vira um único HTML de cerca de 395 KiB em interface/dist/html-service/Interface.html (D-043). Transporte único: google.script.run.pulsoChamar(acao, pedido).
- Pré-visualização local (local/servidor-preview.js): só 127.0.0.1, google.script.run simulado, opções --seed e --falhas-simuladas, PULSO_PREVIEW_ATRASO_MS. Não é integração Google.
- Chave por tentativa lógica, classificação "nada gravado / incerto / conflito / pendente" e registro de envios por sessão (D-045). A interface valida só formato (D-046).
- Testes: 359 na raiz e 39 na interface. npm run mutacao: 113 defeitos, 110 detectados e 3 equivalentes justificados (MUT-10, MUT-11 e MUT-37). npm run interface:mutacao: 13 defeitos, 13 detectados.
- Pendente em M-06: navegador real em 360, 390, 768 e 1440 px, capturas em docs/capturas/, teclado de ponta a ponta e prefers-reduced-motion (D-047).
- Google: sem acesso efetivo; nenhum adaptador de Sheets (D-048).

## 3. AMBIENTE E LINHA DE BASE

1. Preserve alterações locais encontradas. Confira Git e branch. Conclua M-06 em interface-angular; crie a branch m03-operacoes a partir dela para M-03. Sem merge ou push.
2. Node/npm podem não estar no PATH. Foi usado /tmp/merca27-runtime/node-v22.23.5-linux-x64/bin (Node 22.23.5, npm 10.9.9). Se a pasta não existir, baixe o Node 22 oficial para /tmp e confira o SHA-256 antes de extrair. Nada global.
3. O volume é vfat montado com showexec: nenhum binário roda a partir dele. Mantenha bin-links=false. Instale a interface com npm run interface:instalar (npm ci --ignore-scripts) e use sempre os scripts da raiz, que executam o Angular por local/interface.js com ESBUILD_BINARY_PATH (D-042).
4. Antes de alterar, execute: npm ci, npm test, npm run check, npm run typecheck, npm run demo, npm run interface:instalar, npm run interface:typecheck, npm run interface:test e npm run interface:build. Corrija falhas reais sem enfraquecer testes.
5. Execute npm run mutacao (cerca de 30 minutos) e npm run interface:mutacao (cerca de 5 minutos) nos marcos relevantes e no fim. Alvos ausentes, erros de compilação contados como detecção ou sobreviventes sem justificativa são falhas. local/mutacao.js copia interface/src porque tests/contraste.test.js depende dele; qualquer teste novo que leia arquivos fora de src/, local/, tests/ e fixtures/ exige o mesmo cuidado, ou mascara sobreviventes.
6. Commits com identidade por comando, sem mudar a configuração global: git -c user.name="PULSO Dev" -c user.email="dev@merca27.invalid" commit.
7. As bases da Fase 00 têm outro esquema, e as da Fase 01 usam o payload { tabela, linha }. Nunca apague nem migre silenciosamente. Use PULSO_DADOS temporário nos testes.

## 4. ETAPA 1: CONCLUIR M-06 NO NAVEGADOR

1. Verifique quais navegadores podem ser executados com autorização efetiva: Firefox do sistema via flatpak-spawn --host, Chromium baixado em /tmp com puppeteer-core, ou Maestri Portal (leia a skill antes de usá-la). Não contorne bloqueios de permissão. Se nenhum caminho for autorizado, registre em docs/DECISOES.md e docs/RELATORIO_INTERFACE.md e siga para M-03 sem marcar M-06 como concluída.
2. Rode PULSO_DADOS=<pasta temporária> npm run interface:build e depois npm run interface:preview -- --seed --falhas-simuladas. Use PULSO_PREVIEW_ATRASO_MS=800 para observar o carregamento. Abra http://127.0.0.1:4827/.
3. Em 360, 390, 768 e 1440 px, grave capturas reais em docs/capturas/ de: lista de produtos, detalhe com histórico e versões, formulário com erros, falha incerta, conflito, aviso de reconciliação pendente, reposição e estado vazio (pasta sem seed).
4. Verifique: cadastro -> entrada -> saldo; clique duplo; repetição após falha (POST /__preview/falha com {"modo":"depois"}, depois "Repetir com a mesma chave"); conflito (alterar a quantidade após falha incerta); falha antes de executar ({"modo":"antes"}); produto inativo; alteração e versões; erros de domínio; teclado (Tab, Shift+Tab, Enter, foco visível, "Pular para o conteúdo", foco no título ao navegar); prefers-reduced-motion emulado; ausência de rolagem horizontal em 360 px.
5. Corrija defeitos visuais e de acessibilidade com testes. Marque M-06 como concluída só com todos os critérios comprovados. Nunca declare inspeção ou capturas que não executou.

## 5. ETAPA 2: M-03 — VÁRIOS REGISTROS POR OPERAÇÃO

Objetivo: permitir que uma operação grave um conjunto de registros com as mesmas garantias de hoje, preparando as vendas da Fase 2.

### 5.1 Formato e compatibilidade
- Novo payload da intenção: { registros: [{ tabela, linha }, ...] }, com pelo menos um registro, chaves únicas dentro da operação e ordem fixa.
- Operações já gravadas com { tabela, linha } continuam legíveis como uma lista de um registro, sem reescrever o log. Toda gravação nova usa o formato novo. Documente a compatibilidade em docs/DECISOES.md e teste a leitura de uma base da Fase 01 gerada pelo código atual.
- Defina o significado de referencia_id nos eventos de operações com vários registros (por exemplo, a chave do primeiro registro ou um identificador da operação) e valide-o com o mesmo rigor de hoje.

### 5.2 Pontos do código que assumem um único registro (todos precisam mudar)
- src/infra/repositorio.js: abrirIntencao (exige exatamente as chaves tabela e linha), conferirIntencao (reconstrói uma linha por tipo), dobrarOperacoes (compara referencia_id com operacao.linha), conferirOrigem (operacao.tabela e operacao.linha), a checagem de presença em carregarEstado (hoje basta existir uma linha com o operacao_id) e a reprodução cronológica (usa operacao.linha).
- src/application/operacoes.js: gravarNova (anexa um registro), concluir (usa existe para um registro) e linhaEvento/referenciaId.
- src/application/casos-de-uso.js: construir passa a devolver a lista de registros.
- tipos/contratos.d.ts: novos tipos de intenção e de operação.

### 5.3 Regras
- Gravação: intenção PENDENTE -> cada registro, com releitura e comparação completa após cada um -> CONFIRMADA.
- Reconciliação: grava apenas os registros ausentes, na ordem da intenção, e confere que o conjunto final é exatamente o da intenção, nem mais nem menos.
- Operação confirmada com registro ausente ou extra, ou registro cuja operação não o lista, resulta em DADOS_INCONSISTENTES.
- Nenhum registro de operação incompleta compõe saldos, versões, reposição ou listagens.
- A validação da intenção e a reprodução cronológica devem ser ampliadas na mesma medida: cada registro é reconstruído pelas regras de domínio do seu tipo. Não remova verificações para aceitar o formato novo.

### 5.4 Primeiro uso real: contagem de inventário com vários SKUs
Para provar M-03 com uma operação de negócio, e não só com um tipo de teste, implemente CONTAGEM_INVENTARIO: um pedido com vários SKUs e suas quantidades contadas, um motivo e o operador simulado, gerando um movimento AJUSTE por SKU com diferença.
- Tudo ou nada: SKU inexistente, SKU repetido no pedido, quantidade inválida ou nenhuma diferença recusa o pedido inteiro, sem gravar nada.
- SKUs sem diferença não geram movimento; a resposta informa quais foram ajustados e quais já conferiam.
- Saldos anterior e novo e o custo de referência são capturados dentro da trava, como no AJUSTE atual (D-031).
- Exponha a ação no despacho somente se a interface ganhar a tela correspondente nesta execução; caso contrário, deixe-a disponível só pela CLI e registre a decisão.
- Registre a escolha deste caso de uso em docs/DECISOES.md. Se, ao ler o código, outro caso de uso fizer mais sentido, justifique a troca.

### 5.5 Testes e medição
- Falha antes, depois e silenciosa em cada posição da lista: nunca anuncia sucesso, e a repetição com a mesma chave conclui sem duplicar.
- Repetição confirmada (OPERACAO_DUPLICADA), conflito com dados diferentes e reconciliação automática antes de novo lançamento.
- Adulteração: registro removido, extra, alterado, trocado de operação ou com ordem diferente; payload antigo e novo adulterados.
- Concorrência real com processos, como os testes atuais.
- Os testes atuais de entrada, cadastro, alteração e movimentos continuam aprovados sem enfraquecimento. Se algum teste forjar payload no formato antigo, mantenha-o como teste de compatibilidade e crie o equivalente no formato novo.
- Mutações novas em local/mutacao.js para cada regra de M-03 e para CONTAGEM_INVENTARIO.
- Meça com npm run medir antes e depois e registre em docs/evidencias/.

## 6. FORA DESTA EXECUÇÃO

Vendas (Fase 2) só começam depois de M-03 aprovada, numa nova execução. Também ficam fora: estorno, reversão de perda e ajuste, dashboard, automações periódicas, lotes e validade, e cadastro de fornecedor pela interface. Google só com acesso efetivo e autorizado para executar Apps Script, com adaptadores finos, cabeçalhos exatos, testes na planilha real e nada público. Não simule integração concluída.

## 7. ENTREGA

Conclua cada fatia com testes antes de cada commit local. Não publique, não envie ao remoto e não exponha credenciais. Use somente dados fictícios.

Atualize README.md, docs/PROGRESSO.md, docs/DECISOES.md, docs/TESTES.md, docs/MELHORIAS_PLANEJADAS.md e docs/RELATORIO_INTERFACE.md (resultado do navegador). Crie docs/RELATORIO_M03.md com arquivos, comandos, resultados, compatibilidade com bases anteriores, desempenho, limitações e situação real do Google. Reescreva este prompt para a Fase 2 (vendas) com base no que existir. Se algum critério não puder ser cumprido, registre o que falta sem marcar a funcionalidade como concluída.

COMECE AGORA pela leitura, pela linha de base e pelo plano curto; depois conclua M-06 no navegador e só então implemente M-03.
```
