# Prompt para a próxima execução — PULSO

Estado de referência: Fase 01 concluída localmente em 18/11/2026, branch `fase-01`. Em 19/11/2026 o proprietário decidiu fazer a interface de M-06 com Angular e Tailwind CSS (D-040). Este arquivo descreve a execução seguinte; ainda não foi executado.

```text
# MERCA 27 — PULSO — M-06: INTERFACE ANGULAR + TAILWIND E INTEGRAÇÃO GOOGLE CONDICIONAL

Você é o engenheiro responsável pelo PULSO, sistema de gestão de um mercado inteiramente fictício. Trabalhe diretamente nos arquivos, teste e documente. Apresente um plano curto e execute sem esperar confirmação para decisões técnicas rotineiras.

## 1. LEITURA OBRIGATÓRIA

Leia integralmente:
- docs/RELATORIO_FASE_01.md, docs/PROGRESSO.md, docs/DECISOES.md (especialmente D-002, D-027 e D-040) e docs/TESTES.md.
- docs/MELHORIAS_PLANEJADAS.md, especialmente M-06.
- Os cinco documentos-base, de docs/00_COMECE_AQUI.md a docs/04_ROTEIRO_EXECUCAO_E_PROMPT.md.
- README.md, fixtures/SEED_README.md e todo o código em src/, local/, tipos/ e tests/.

Confirme o estado real pelo código e pelos comandos. Os cinco documentos-base estão na v1.1.0 e já registram a decisão por Angular + Tailwind (A002-ADR-011, D-040). Não os altere nesta execução; registre divergências em docs/DECISOES.md.

## 2. ESTADO REAL

- Branch fase-01, criada depois da revisão da Fase 00. Commits locais por bloco, sem merge em main, sem envio ao remoto e sem publicação.
- 343 testes aprovados, sintaxe válida em 35 arquivos, as duas configurações de tipos e a demo aprovadas.
- O núcleo src/ é feito de scripts globais `var PULSO`, com fábricas nomeadas e contratos JSDoc inferidos por tipos/contratos.d.ts. Não usa APIs do Node e não tem build (D-002, D-027). Isso não muda.
- Portas: armazenamento { ler, anexar }, lock { executar }, relogio e gerarId.
- Cada operação ainda guarda somente { tabela, linha }. Protocolo PENDENTE -> dado -> CONFIRMADA, com verificação completa após escrever, idempotência e conflito.
- Antes de cada novo lançamento, as pendências são reconciliadas automaticamente dentro da trava e o estado é recarregado. A reconciliação manual também existe.
- Consultas não usam trava. DADOS_INCONSISTENTES provoca uma única repetição sob trava. Falha de leitura retorna FALHA_LEITURA. Toda repetição confirmada traz o aviso OPERACAO_DUPLICADA. O saldo é derivado e nunca gravado.
- Tabelas: FORNECEDORES, PRODUTOS, PRODUTOS_ALTERACOES, MOVIMENTOS_ESTOQUE e OPERACOES_LOG.
- APIs: cadastrarFornecedor, listarFornecedores, cadastrarProduto, alterarProduto, desativarProduto, reativarProduto, consultarHistoricoProduto, registrarSaldoInicial, registrarEntrada, registrarPerda, ajustarPorContagem, consultarEstoque, listarProdutos, consultarReposicao e reconciliarPendencias.
- Entrada exige custoUnitCentavos e fornecedorId. Perda exige quantidade positiva, motivo e categoriaPerda (AVARIA, VENCIMENTO ou QUEBRA). Ajuste exige quantidadeContada inteira >= 0 e motivo. O custo da perda e do ajuste vem do cadastro vigente.
- Alteração aceita nome, categoria, precoVendaCentavos, custoRefCentavos, estoqueMinimo, estoqueAlvo, fornecedorId ou ativo e exige motivo. SKU e unidade são imutáveis.
- Produto desativado não aceita entrada, mas aceita perda e ajuste. Versões e movimentos anteriores são preservados.
- Seed determinística com 40 SKUs e seis fornecedores, semente 27. Os seis SKUs originais estão fixados por teste. A seed não cria movimentos.
- Reposição: produto ativo com saldo <= mínimo; sugestão max(0, alvo - saldo). É só consulta, com revisão humana.
- local/cli.js cobre todos os fluxos. local/mutacao.js aplica 108 defeitos somente em cópias temporárias (cerca de 15 minutos). local/medir-desempenho.js usa 90 dias sintéticos em pasta temporária.

## 3. AMBIENTE E LINHA DE BASE

1. Preserve alterações locais que encontrar. Confira Git e branch e crie uma branch `interface-angular` a partir de fase-01, sem merge nem push.
2. Node e npm podem não estar no PATH. Na Fase 01 foi usado /tmp/merca27-runtime/node-v22.23.5-linux-x64/bin (Node 22.23.5, npm 10.9.9). Não presuma que a pasta ainda exista. Se precisar, baixe o Node 22 oficial para /tmp e confira o SHA-256 antes de extrair. Nada de instalação global.
3. O volume é vfat e não aceita links simbólicos. Mantenha `bin-links=false` em .npmrc, tanto na raiz quanto em interface/. Por isso, chame as ferramentas pelo caminho do script, como já faz o typecheck (por exemplo `node node_modules/@angular/cli/bin/ng.js`), e nunca por node_modules/.bin.
4. Na raiz, execute npm ci, npm test, npm run check, npm run typecheck e npm run demo antes de alterar qualquer coisa. Corrija falhas reais sem enfraquecer testes. As versões da raiz continuam fixadas (typescript 5.9.3, @types/node 22.20.5); não as troque para atender o Angular.
5. Execute npm run mutacao nos marcos relevantes e no fim. Alvos ausentes, ou sobreviventes sem justificativa, contam como falha.
6. Commits com identidade por comando, sem mudar a configuração global: git -c user.name="PULSO Dev" -c user.email="dev@merca27.invalid" commit.
7. As bases da Fase 00 têm outro esquema. Nunca as apague nem migre silenciosamente. Use outro PULSO_DADOS temporário nos testes.

## 4. STACK DA INTERFACE (D-040)

- Crie um projeto Angular separado em interface/, com package.json, package-lock.json e .npmrc próprios. O núcleo e a raiz não ganham dependências do Angular. node_modules/ e dist/ de interface/ ficam no .gitignore.
- Use a versão estável mais recente do Angular que aceite Node 22, com a versão de TypeScript que ela exigir dentro de interface/. Tailwind CSS v4 pela integração oficial com PostCSS. Fixe versões exatas no lockfile (sem ^ nem ~) e registre as escolhidas em docs/DECISOES.md.
- Componentes standalone, signals, controle de fluxo nativo (@if, @for), formulários reativos tipados e TypeScript strict em interface/. Zoneless, se a versão adotada considerar estável.
- Use HashLocationStrategy ou rotas internas sem depender do caminho da URL: o HTML Service roda dentro de um iframe do Google, onde o roteamento por caminho não funciona.
- Configure as cores do Documento Mestre como tokens do tema Tailwind (@theme): fundo #F5F5F0, texto #1B2725, verde #17685B, âmbar #DCA44C, destaque #DCEAE4 e superfícies brancas. Confira o contraste. O âmbar só aparece como fundo ou destaque, com texto escuro. Interface operacional e clara, sem métricas inventadas.
- Nada de bibliotecas de componentes (Angular Material, PrimeNG etc.) nem de fontes ou scripts de CDN no build final. Tudo deve sair embutido.

## 5. ARQUITETURA E BUILD PARA O HTML SERVICE

- A interface não reimplementa regras de domínio. Um serviço Angular de gateway (por exemplo `PulsoGateway`) expõe as ações necessárias e tem duas implementações escolhidas na inicialização:
  - Apps Script: envolve google.script.run (withSuccessHandler e withFailureHandler) em Promises ou Observables.
  - Pré-visualização local: chama o servidor de desenvolvimento descrito abaixo.
- Tipos das requisições e respostas: reutilize ou espelhe tipos/contratos.d.ts. Não duplique validações de negócio. A validação no formulário existe só para ajudar o usuário; o domínio continua validando tudo por conta própria.
- Servidor de pré-visualização local em local/, ouvindo somente em 127.0.0.1. Ele serve o build e expõe apenas as ações necessárias, chamando os mesmos casos de uso pela CLI ou pelo app local já existente. É ferramenta de desenvolvimento e não conta como integração Google.
- O build de produção precisa gerar um único arquivo HTML autocontido, com JS e CSS embutidos, pronto para HtmlService.createHtmlOutputFromFile. Faça um script de pós-build sem dependências novas na raiz (por exemplo local/empacotar-interface.js) e registre o tamanho final. Confira que o HTML resultante funciona servido por HTML Service: sem import dinâmico de arquivos externos, sem service worker, sem lazy loading de chunks separados.
- Comandos novos na raiz chamam o Angular por caminho de script: por exemplo `npm run interface:build`, `npm run interface:test` e `npm run interface:preview`. Ajuste local/verificar-sintaxe.js para ignorar interface/node_modules e interface/dist sem reduzir a cobertura atual.

## 6. ESCOPO FUNCIONAL DE M-06

Não crie backend de produção, banco remoto nem dashboard.

Cubra:
- Listagem e busca de produtos e fornecedores.
- Cadastro e alteração de produto, desativação e reativação, com histórico de versões.
- Registro de entrada com fornecedor e custo unitário explícitos.
- Saldo com histórico auditável e consulta da reposição sugerida.
- Saldo inicial, perda e ajuste em formulários simples sobre os casos já estáveis, mantendo motivos e categorias obrigatórios.

Implemente os estados vazio, carregando, sucesso, falha, conflito e reconciliação pendente. Desabilite o envio durante o processamento. Gere um requisicaoId por tentativa lógica e reutilize a mesma chave e os mesmos dados ao repetir depois de uma falha. Dados diferentes com a mesma chave devem mostrar REQUISICAO_CONFLITANTE. Mostre sucesso somente após a confirmação real. Diferencie "o retorno falhou, a gravação pode ter acontecido" de "com certeza nada foi gravado".

Formulários precisam de rótulos, mensagens associadas (aria-describedby), foco adequado após erro e após sucesso, navegação completa por teclado e respeito a prefers-reduced-motion (variantes motion-safe/motion-reduce do Tailwind). Mostre valores em BRL com clareza e converta para centavos inteiros na fronteira do gateway.

## 7. TESTES E VERIFICAÇÃO

- Testes unitários com o executor padrão da versão de Angular adotada, cobrindo gateway, conversão BRL <-> centavos, geração e reutilização de requisicaoId, estados de tela e clique duplo. Não baixe navegadores globalmente; se o executor exigir navegador, use um disponível no ambiente ou documente a limitação.
- Mantenha aprovados os testes do núcleo, de concorrência, de adulteração e de mutação.
- Use um navegador real disponível no ambiente. Se usar o Maestri Portal, leia antes a skill correspondente. Teste em 360, 390, 768 e 1440 px e grave capturas reais em docs/capturas/, a partir do HTML único empacotado e não só do `ng serve`.
- Verifique cadastro -> entrada -> saldo, clique duplo, repetição após falha, conflito, produto inativo, alteração e histórico, erros de domínio, vazio, carregamento e teclado. Nunca declare inspeção no navegador ou capturas que não executou.

## 8. GOOGLE: SOMENTE COM ACESSO EFETIVO

Verifique separadamente o acesso ao Drive/Sheets e a capacidade autorizada de executar Apps Script. O conector Drive respondeu na Fase 00, mas isso não permitiu executar o núcleo. Não presuma autenticação, não peça senhas e não contorne permissões.

Se houver acesso efetivo e autorizado:
- Implemente adaptadores finos para SpreadsheetApp, LockService, relógio e Utilities.getUuid.
- Use os cabeçalhos exatos das cinco tabelas, conversão entre célula vazia e null, instantes ISO como texto e leitura e escrita em lote.
- Preserve escrita por intenção, dado e confirmação, além de releitura, histórico, idempotência e reconciliação. O Sheets não tem rollback automático entre abas.
- Adicione um menu que abre o HTML único gerado pelo build Angular via HTML Service, usando o gateway do Apps Script.
- Execute na planilha real o cenário de entrada de 10 unidades, repetição sem duplicação, valores inválidos e saldo reconciliado. Teste a nova camada de persistência e registre as evidências separadamente.
- Não crie web app público, compartilhamento público, automações de e-mail nem publicação sem autorização específica.

Sem esse acesso, conclua a interface local e documente a integração como pendente. Não simule uma integração concluída.

## 9. FORA DESTA EXECUÇÃO

M-03, vendas com vários itens, estorno, reversão de perda e ajuste, dashboard, automações periódicas, lotes e validade ficam para depois. Não avance automaticamente ao terminar M-06.

M-03 será a próxima mudança estrutural: vários registros por operação e verificação integral do conjunto, antes da Fase 2. A validação da intenção e a reprodução cronológica em src/infra/repositorio.js devem ser ampliadas na mesma medida; não remova verificações para aceitar tipos novos.

## 10. ENTREGA

Conclua cada fatia completa, com testes, antes de cada commit local. Não publique, não envie ao remoto e não exponha credenciais. Use somente dados fictícios.

Marque M-06 como concluída somente com todos os critérios de aceite comprovados, inclusive navegador e capturas. Atualize README.md (como instalar e rodar a interface), docs/PROGRESSO.md, docs/DECISOES.md (versões fixadas, tamanho do HTML único, decisões de roteamento e detecção de mudanças), docs/TESTES.md e docs/MELHORIAS_PLANEJADAS.md. Crie docs/RELATORIO_INTERFACE.md com arquivos, comandos, resultados, evidências visuais, limitações e a situação real do Google. Reescreva este prompt para M-03 e a Fase 2 com base no que existir. Se algum critério não puder ser cumprido, registre o que falta sem marcar a funcionalidade inteira como concluída.

COMECE AGORA pela leitura, pela linha de base e pelo plano curto; depois implemente M-06.
```
