# PULSO — próxima execução: Fase 3 (dashboard e automações)

**Referência em 19/11/2026:** branch `fase-02-vendas`. Fases 00/01, M-03 e funcionalidades da Fase 2 implementadas e verificadas localmente. M-06 continua parcial por falta de navegador real. Este prompt descreve a próxima execução; dashboard e automações ainda não foram implementados.

## Missão

Executar a Fase 3 diretamente no repositório: indicadores por período reconciliáveis, interface de visão geral e resumo operacional diário com execução local controlada. Preservar estoque, vendas e estornos. Não declarar integração Google, notificação ou teste de navegador sem evidência real.

## 1. Leitura e estado real

Leia integralmente README, `interface/README.md`, `fixtures/SEED_README.md`, `docs/RELATORIO_FASE_02.md`, `RELATORIO_M03.md`, `RELATORIO_INTERFACE.md`, `PROGRESSO.md`, `DECISOES.md`, `TESTES.md` e `MELHORIAS_PLANEJADAS.md`. Leia os cinco documentos-base v1.1.0, especialmente mestre 10–15 e 20–21, arquitetura 8, 11 e 12, roteiro Fase 3. Preserve os originais; estados/contagens antigos estão desatualizados (D-054).

Leia todo o código próprio de `src/`, `local/`, `tipos/`, `tests/` e `interface/src/`, os manifestos, configurações e evidências. Não trate planejamento histórico como ordem para refazer Fase 00. Código e testes executados prevalecem sobre números antigos deste prompt.

Estado de referência:

- Núcleo em scripts globais `var PULSO`, sem imports, APIs Node ou build. Portas: armazenamento `{ ler, anexar }`, lock `{ executar }`, relógio e IDs. Consultas sem trava com uma repetição sob trava quando há inconsistência; nenhuma gravação em consulta.
- Oito tabelas: FORNECEDORES, PRODUTOS, PRODUTOS_ALTERACOES, MOVIMENTOS_ESTOQUE, VENDAS, ITENS_VENDA, ESTORNOS_VENDA, OPERACOES_LOG. Esquema exato em `src/infra/esquema.js`.
- Intenção `{ registros: [{ tabela, linha }, ...] }`, 1–200 registros ordenados, escrita e releitura integral de cada um antes da confirmação. Pendências são reconciliadas antes de nova operação. Referência do evento é a chave do primeiro registro. Operação confirmada precisa de todos os registros, sem extras nem divergências.
- Compatibilidade `{ tabela, linha }` só para os sete `TIPOS_LEGADOS`; nunca ampliar essa lista para operações novas. `fixtures/base-fase01/` é imutável e não pode ser regenerada.
- Contagem de inventário até 100 itens, somente núcleo/CLI; sem ação de interface. Reversões de perda/ajuste/contagem permanecem adiadas (D-058). Não usar estorno de venda para corrigir isso.
- Venda: 1–50 SKUs distintos, ordenados, tudo ou nada sob trava. Pagamento informativo DINHEIRO/PIX/CARTAO, sem descontos. Preço e custo capturados no instante da venda. Estorno total e único com motivo, devolvendo todos os itens como revendáveis, sem alterar o registro original. Estado ESTORNADA é derivado.
- `listarVendas({ desde?, ate?, limite? })`: ISO UTC, início inclusivo e fim exclusivo, 100 por padrão e máximo 500. Não usar essa lista limitada para calcular KPIs: consultar o estado completo na camada de aplicação. Detalhe por vendaId ou requisicaoId, exatamente um.
- Interface Angular 22.3.0, Tailwind 4.3.5, TypeScript 6.0.3 strict, dependências próprias. Rotas por hash, importação imediata, um HTML autocontido. Último build de referência: 434.763 bytes. Sem CDN, lazy loading ou biblioteca de componentes.
- Despacho tem 18 ações; vendas acrescentaram confirmarVenda, estornarVenda, listarVendas e consultarVenda. Não expõe cadastro de fornecedor nem contagem. Transporte único google.script.run, simulado na pré-visualização em 127.0.0.1.
- Chave por tentativa lógica (D-045): incerto preserva chave/dados, repetir reenvia o pedido incerto, clique duplo bloqueado. Registro dura a sessão, não recarga. Nas telas de vendas, comprovante e recarga observam sucesso inclusive por repetição compartilhada. `Campo` remove id do wrapper para evitar IDs duplicados.
- Referência: 507 testes do núcleo, 51 da interface, 163 alvos de mutação no núcleo e 26 na interface. Resultados completos e sobreviventes justificados em TESTES/evidências; confirme os números antes de reutilizá-los.

## 2. Ambiente, preservação e linha de base

Inspecione Git, mudanças locais e ferramentas. Preserve trabalho existente; crie `fase-03-dashboard` a partir da Fase 2 se ainda não houver branch adequada. Não resete nem apague bases.

Node/npm podem estar fora do PATH. Existe runtime oficial temporário validado em `/tmp/merca27-runtime/node-v22.23.5-linux-x64/bin`; use-o se existir. Se faltar, baixe runtime oficial em `/tmp`, confira checksum, sem instalação global. O volume vfat tem showexec e não permite symlinks: `.npmrc` usa bin-links=false. Dependências via `npm ci --ignore-scripts --no-audit --no-fund` e `npm run interface:instalar`; ferramentas da interface sempre pelos scripts da raiz. `local/interface.js` prepara esbuild em `/tmp`. A instalação pode demorar bastante neste volume; aguarde terminar antes de diagnosticar tipos ausentes.

Antes de alterar, execute npm test, check, typecheck, demo, interface:typecheck, interface:test, interface:build e `npm run mutacao -- --verificar-alvos`. Meça `npm run medir` e salve JSON novo. Use apenas pastas temporárias para testes e sementes, nunca a base de outra execução.

Execute as baterias completas `npm run mutacao` e `npm run interface:mutacao` em marcos/final. Demoram: não interrompa só pelo tempo. Não rode testes, builds ou medição concorrentes com elas. Alvo ausente, erro de compilação/execução e sobrevivente sem justificativa são falha. Preserve o defeito conceitual ao adaptar alvos. Testes que leiam arquivos fora da lista copiada exigem ampliar a cópia do executor para não mascarar sobreviventes. Não aceite teste passando por erro de forma ou causa diferente da asserção pretendida.

Commits locais por fatia, após testes: `git -c user.name="PULSO Dev" -c user.email="dev@merca27.invalid" commit`. Sem push, merge em main ou publicação.

## 3. M-06 e Google: condições reais

D-047/D-054/D-061 registram chamadas de navegador negadas e Maestri sem CLI. Não repetir meios negados sem nova autorização. Se o proprietário tiver autorizado um caminho permitido e disponível (Firefox do host, Chromium em /tmp ou Maestri), validar o HTML único a 360, 390, 768 e 1440 px, teclado, foco, movimento reduzido, jornada de vendas/estorno e dashboard; salvar capturas reais em docs/capturas. Sem caminho disponível/autorizado, registrar a impossibilidade e continuar o trabalho local. M-06 permanece parcial.

Google continua pendente. Conector Drive não prova acesso para executar Apps Script. Só integrar se houver autorização efetiva e ferramenta adequada, sem credenciais no repositório. Não criar triggers, publicar app ou enviar notificações reais com base em presunção de acesso. Sem isso, testar a automação localmente e documentar a porta futura.

## 4. Política dos indicadores antes da implementação

Registre uma decisão explícita sobre período e estornos, com exemplos de fronteira. Recomenda-se expor separadamente vendas brutas realizadas no período, devoluções registradas no período e receita após devoluções, com nomes claros. Estorno de venda de período anterior precisa ter tratamento documentado; não retirar uma venda histórica só porque hoje está estornada.

Defina número de vendas, unidades brutas, unidades devolvidas, ticket médio e CMV/margem de forma coerente com a política escolhida. Para ticket médio, explicite numerador e denominador; zero vendas deve ser N/D. Margem percentual com denominador zero deve ser N/D. Um período com apenas estornos pode ter resultado negativo, se essa for a política por data do evento, sem ser convertido em zero silenciosamente.

Use centavos e unidades inteiras exatas. CMV gerencial é a captura dos itens; estorno usa o mesmo custo original, mesmo após mudar cadastro. Perda é separada de venda. Valores estimados de estoque devem indicar se são atuais ou um retrato no fim do período; não misturar ambos sem rótulo. Não chamar margem bruta de lucro líquido, receita de caixa, nem os números de resultado real.

## 5. Consultas do dashboard

Implemente domínio puro para agregação e casos de uso de consulta sobre o estado completo validado. Entrada com limites ISO UTC válidos, `[desde, ate)` e período explícito; apresentação em America/Sao_Paulo. Se a interface aceitar dias locais, converta corretamente para instantes UTC na fronteira, com testes de meia-noite, sem misturar data local com UTC.

Mínimo: receita bruta e devoluções, receita após devoluções, número de vendas, unidades, ticket, CMV/margem estimados, perdas em unidades/valor e reposição. Pode incluir receita por SKU e série diária se trouxerem rastreabilidade. Não somar pendências ou registros incompletos. Retorne IDs/linhas de origem ou consulta de detalhamento que permita conferir o indicador. Não cachear saldo persistente nem relaxar verificações de integridade.

Teste T15/T16 e reconciliações da arquitetura 12.3. Casos: base vazia, período sem vendas, limites inclusivo/exclusivo, muitos registros além do limite de listarVendas, vários itens, preço/custo alterados depois, venda/estorno no mesmo período e em períodos distintos, somente estornos, perda/ajuste separados, falha parcial e adulteração. Compare agregação com cálculo independente dos registros confirmados, sem repetir o algoritmo do código.

## 6. Interface de visão geral

Acrescente somente as ações necessárias ao despacho, contratos e gateway. Sem regras de negócio nos componentes. Filtros de período visíveis, unidades e fórmulas acessíveis, valores estimados rotulados, estados vazio/carregando/falha, links até vendas ou movimentos. Mantenha a identidade PULSO, contraste AA, rótulos, foco e navegação responsiva. Gráficos apenas se ajudarem, sem biblioteca pesada ou números inventados.

Teste componentes e acrescente mutações para período enviado, N/D, dados devolvidos pelo núcleo, navegação de detalhe e estados. Build deve continuar em HTML único e dentro do orçamento; informe tamanho final. Não afirmar teste de navegador com base em jsdom.

## 7. Resumo diário e automação local

Implemente primeiro a geração do resumo operacional diário (reposições, movimentação, falhas/pendências), com dia/fuso, instante e origem explícitos. A geração deve ser reconciliável com as mesmas consultas do dashboard.

Para uma execução programada, escolha e documente chave idempotente por tipo/dia e estratégia de logs de tentativa/sucesso/falha. Qualquer tabela/tipo novo precisa ampliar esquema, validação da intenção, reprodução e testes; aproveitar o protocolo M-03, sem criar log paralelo sem integridade. Defina como distinguir reexecutar geração de enviar notificação: o protótipo local pode preparar o resumo e registrar execução sem enviar nada.

Disponibilize CLI de execução manual e simulação de agenda com relógio controlado e porta de entrega falsa. Teste repetição do mesmo dia, dias distintos, falha antes/depois de persistir, recuperação, concorrência e resumo com pendência. Se não houver meio autorizado para agenda real, não invente trigger ativo; registre execução local e adaptador futuro. Não enviar e-mails ou mensagens reais nem configurar destinatários sem instrução explícita do proprietário.

## 8. Volume, medição e entrega

Crie cenário determinístico de 90 dias com vendas de vários itens, estoque suficiente na ordem dos eventos, perdas e estornos, incluindo fronteiras entre períodos. Catálogo seed existente e fixture da Fase 01 ficam intactos; cenário deve usar pasta temporária e ter totais independentes conhecidos. Meça consultas/escritas atuais e dashboard, indicando volume de cada caso, aquecimentos, amostras e leituras. Sem benchmarks concorrentes com mutação, testes ou build; não extrapole para Google.

Ao terminar cada fatia, execute verificações apropriadas e registre commit local. No final, rode os controles completos, as duas baterias de mutação e medição isolada. Não reduzir cobertura para produzir contagem verde. Documente sobreviventes equivalentes com a regra que ainda recusa o caso.

Atualize README, PROGRESSO, DECISOES, TESTES, MELHORIAS_PLANEJADAS e RELATORIO_INTERFACE quando pertinente. Crie `docs/RELATORIO_FASE_03.md` com arquivos, decisões, comandos/resultados, política temporal, conciliação independente, compatibilidade, desempenho e limitações reais. Reescreva este prompt para o próximo passo baseado no que existe. Critérios incompletos devem ficar explícitos; não marcar M-06/Google ou agenda real como concluídos sem executar.

Fora desta fase: despesas, fiscal, pagamentos reais, lotes/FEFO, descontos, estornos parciais, compra automática, banco remoto, autenticação própria, IA e publicação. Reversão administrativa pendente deve continuar registrada ou receber uma fatia própria se houver espaço após os objetivos centrais.
