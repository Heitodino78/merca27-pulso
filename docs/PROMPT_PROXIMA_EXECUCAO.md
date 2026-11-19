# Prompt para a próxima execução — PULSO

Estado de referência: Fase 01 concluída localmente em 18/11/2026, branch `fase-01`. Este arquivo descreve a execução seguinte; não foi executado durante a Fase 01.

```text
# MERCA 27 — PULSO — M-06: INTERFACE E INTEGRAÇÃO GOOGLE CONDICIONAL

Você é o engenheiro responsável pelo PULSO, sistema de gestão de um mercado inteiramente fictício. Trabalhe diretamente nos arquivos, teste e documente. Apresente um plano curto e execute sem aguardar confirmação para decisões técnicas rotineiras.

## 1. LEITURA OBRIGATÓRIA

Leia integralmente:
- docs/RELATORIO_FASE_01.md, docs/PROGRESSO.md, docs/DECISOES.md e docs/TESTES.md.
- docs/MELHORIAS_PLANEJADAS.md, especialmente M-06.
- Os cinco documentos-base docs/00_COMECE_AQUI.md a docs/04_ROTEIRO_EXECUCAO_E_PROMPT.md.
- README.md, fixtures/SEED_README.md, todo o código em src/, local/, tipos/ e tests/.

Confirme o estado real pelo código e pelos comandos. Preserve os cinco documentos-base e registre divergências em docs/DECISOES.md.

## 2. ESTADO REAL

- Branch fase-01, criada após registrar a revisão da Fase 00. Commits locais por bloco; sem merge em main, remoto ou publicação.
- 343 testes aprovados; sintaxe em 35 arquivos; duas configurações de tipos e demo aprovadas.
- Núcleo src/ em scripts globais var PULSO, com fábricas nomeadas e contratos JSDoc inferidos por tipos/contratos.d.ts; sem APIs do Node.
- Portas: armazenamento { ler, anexar }, lock { executar }, relogio e gerarId.
- Uma operação ainda guarda somente { tabela, linha }. Protocolo PENDENTE -> dado -> CONFIRMADA, verificação completa após escrever, idempotência e conflito.
- Reconciliação automática antes de novo lançamento, dentro da trava, com recarga do estado; reconciliação manual também disponível.
- Consultas sem trava; DADOS_INCONSISTENTES provoca uma única repetição sob trava; falha de leitura retorna FALHA_LEITURA. Toda repetição confirmada traz aviso OPERACAO_DUPLICADA. Saldo é derivado e nunca persistido.
- Tabelas: FORNECEDORES, PRODUTOS, PRODUTOS_ALTERACOES, MOVIMENTOS_ESTOQUE e OPERACOES_LOG.
- APIs: cadastrarFornecedor, listarFornecedores, cadastrarProduto, alterarProduto, desativarProduto, reativarProduto, consultarHistoricoProduto, registrarSaldoInicial, registrarEntrada, registrarPerda, ajustarPorContagem, consultarEstoque, listarProdutos, consultarReposicao e reconciliarPendencias.
- Entrada exige custoUnitCentavos e fornecedorId. Perda exige quantidade positiva, motivo e categoriaPerda (AVARIA/VENCIMENTO/QUEBRA). Ajuste exige quantidadeContada inteira >= 0 e motivo. Custo de perda/ajuste é capturado do cadastro vigente.
- Alteração usa campos com nome, categoria, precoVendaCentavos, custoRefCentavos, estoqueMinimo, estoqueAlvo, fornecedorId ou ativo; exige motivo. SKU e unidade são imutáveis.
- Desativação impede entrada; perda e ajuste aceitam produto inativo. Versões e movimentos anteriores são preservados.
- Seed determinística: 40 SKUs e seis fornecedores, semente 27; seis SKUs originais preservados por teste. Seed não cria movimentos.
- Reposição: ativo && saldo <= mínimo; sugestão max(0, alvo - saldo), somente consulta e revisão humana.
- local/cli.js cobre todos os fluxos. local/mutacao.js aplica 108 defeitos somente em cópias temporárias (cerca de 15 minutos). local/medir-desempenho.js usa 90 dias sintéticos em pasta temporária.

## 3. AMBIENTE E LINHA DE BASE

1. Preserve alterações locais encontradas. Verifique Git e branch antes de criar uma branch de interface, sem merge ou push.
2. Node/npm podem não estar no PATH. Foi usado /tmp/merca27-runtime/node-v22.23.5-linux-x64/bin (Node 22.23.5, npm 10.9.9). Não presuma que a pasta ainda exista. Se necessário, baixe Node 22 oficial para /tmp e confira SHA-256 antes de extrair; nada global.
3. Volume vfat sem links simbólicos: mantenha .npmrc com bin-links=false. Execute npm ci. Versões fixadas: typescript 5.9.3 e @types/node 22.20.5; não migre para TypeScript nativo neste volume.
4. npm run typecheck chama node node_modules/typescript/lib/tsc.js diretamente. src usa ES2020 e types: []; local usa NodeNext e ES2022. strict permanece false, sem supressões; consulte D-027 antes de alterar essa decisão.
5. Execute npm test, npm run check, npm run typecheck e npm run demo antes de alterar. Corrija falhas reais sem enfraquecer testes. Execute npm run mutacao nos marcos relevantes e no fim; alvos ausentes ou sobreviventes sem justificativa são falhas.
6. Para commits, use identidade por comando, sem mudar configuração global: git -c user.name="PULSO Dev" -c user.email="dev@merca27.invalid" commit.
7. Bases da Fase 00 têm outro esquema; nunca apague nem migre silenciosamente. Use outro PULSO_DADOS temporário para testes.

## 4. ESCOPO PRINCIPAL: M-06

Implemente interface HTML/CSS/JavaScript sem framework, compatível com HTML Service. Não crie backend de produção, banco remoto ou dashboard.

Cubra:
- Listagem e busca de produtos e fornecedores.
- Cadastro e alteração de produto, desativação e reativação, com histórico de versões.
- Registro de entrada com fornecedor e custo unitário explícitos.
- Saldo com histórico auditável e consulta da reposição sugerida.
- Saldo inicial, perda e ajuste podem usar formulários simples sobre os casos já estáveis, mantendo os motivos e categorias necessários.

Crie servidor de pré-visualização local somente em 127.0.0.1, simulando google.script.run e chamando os mesmos casos de uso. Ele é ferramenta de desenvolvimento e não conta como integração Google. Exponha somente as ações necessárias; não duplique regras de domínio na interface.

Aplique a identidade do Documento Mestre: fundo #F5F5F0, texto #1B2725, verde #17685B, âmbar #DCA44C e destaque #DCEAE4, com superfícies brancas. Confira contraste; use âmbar como fundo ou destaque com texto escuro. Interface operacional, clara, sem métricas inventadas.

Implemente estados vazio, carregando, sucesso, falha, conflito e reconciliação pendente. Desabilite envio durante processamento. Gere requisicaoId por tentativa lógica e reutilize a mesma chave e os mesmos dados ao repetir após falha. Dados diferentes com a mesma chave devem apresentar REQUISICAO_CONFLITANTE. Sucesso somente depois da confirmação real. Preserve a distinção entre erro de retorno e certeza de que nada foi gravado.

Formulários precisam de rótulos, mensagens associadas, foco adequado, navegação por teclado e respeito a prefers-reduced-motion. Mostre BRL com clareza e converta para centavos inteiros na fronteira, mantendo validação independente no domínio.

## 5. VERIFICAÇÃO DA INTERFACE

Use navegador real disponível no ambiente; se usar Maestri Portal, leia a skill correspondente antes de aplicá-la. Teste 360, 390, 768 e 1440 px e grave capturas reais em docs/capturas/.

Verifique cadastro -> entrada -> saldo, clique duplo, repetição após falha, conflito, produto inativo, alteração e histórico, erros de domínio, vazio, carregamento e teclado. Nunca declare inspeção de navegador ou capturas sem tê-las executado. Mantenha os testes do núcleo, concorrência, adulteração e mutação aprovados.

## 6. GOOGLE: SOMENTE COM ACESSO EFETIVO

Verifique separadamente acesso ao Drive/Sheets e capacidade autorizada para executar Apps Script. O conector Drive respondeu na Fase 00, mas isso não permitiu executar o núcleo. Não presuma autenticação, não peça senhas e não contorne permissões.

Se houver acesso efetivo autorizado:
- Implemente adaptadores finos para SpreadsheetApp, LockService, relógio e Utilities.getUuid.
- Use cabeçalhos exatos das cinco tabelas, conversão entre célula vazia e null e instantes ISO como texto; leitura e escrita em lote.
- Preserve escrita por intenção/dado/confirmação, releitura, histórico, idempotência e reconciliação. Sheets não oferece rollback automático entre abas.
- Adicione menu e a mesma interface via HTML Service.
- Execute na planilha real o cenário de entrada 10, repetição sem duplicação, valores inválidos e saldo reconciliado. Teste a nova camada de persistência e registre evidências separadas.
- Não crie web app público, compartilhamento público, automações de e-mail ou publicação sem autorização específica.

Sem esse acesso, conclua a interface local e documente a integração como pendente. Não simule uma integração concluída.

## 7. FORA DESTA EXECUÇÃO

M-03, vendas multi-itens, estorno, reversões de perda/ajuste, dashboard, automações periódicas, lotes e validade permanecem para depois. Não avance automaticamente ao terminar M-06.

M-03 será a próxima mudança estrutural: vários registros por operação e verificação integral do conjunto, antes da Fase 2. A validação da intenção e a reprodução cronológica em src/infra/repositorio.js devem ser ampliadas de forma equivalente; não remova verificações para aceitar tipos novos.

## 8. ENTREGA

Conclua uma fatia completa com testes antes de cada commit local. Não publique, não envie ao remoto e não exponha credenciais. Use somente dados fictícios.

Marque M-06 como concluída somente com seus critérios de aceite comprovados, inclusive navegador e capturas. Atualize README.md, docs/PROGRESSO.md, docs/DECISOES.md, docs/TESTES.md e docs/MELHORIAS_PLANEJADAS.md. Crie docs/RELATORIO_INTERFACE.md com arquivos, comandos, resultados, evidências visuais, limitações e situação real do Google. Reescreva este prompt para M-03 e Fase 2 com base no que existir. Se algum critério não puder ser cumprido, registre o que falta sem marcar a funcionalidade inteira como concluída.

COMECE AGORA pela leitura, pela linha de base e pelo plano curto; depois implemente M-06.
```
