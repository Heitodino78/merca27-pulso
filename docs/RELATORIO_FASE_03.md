# Relatório de execução — Fase 3 (parte local)

**Data:** 19/11/2026 · **Branch:** `fase-03-dashboard` (a partir de `fase-02-vendas`) · **Ambiente:** local, dados sintéticos.

## Resultado e escopo

Implementados os indicadores por período no núcleo, a visão geral na interface e o resumo diário sob demanda. A pedido do proprietário, a interface também ficou mais bonita e interativa: novo layout com menu lateral e gaveta, paleta de comandos, gráfico interativo, números animados, esqueletos de carregamento e transições, tudo sem bibliotecas novas e respeitando movimento reduzido.

**Também:** versão estática para o GitHub Pages, com o núcleo rodando no navegador e dados no `localStorage` (D-069), e workflow de publicação.

**Não feito nesta execução:** execução programada do resumo com registro de tentativas e porta de entrega (D-066), navegador real (M-06 continua parcial, D-068) e Google. Fases 00–2 preservadas; documentos-base, catálogo e `fixtures/base-fase01/` intactos.

O runtime temporário do Node tinha sido apagado da pasta `/tmp`. Foi baixado de novo do site oficial e o SHA-256 conferiu com o registrado (`cdeb8670…40f8`). A linha de base bateu exatamente com a Fase 2: 507 testes do núcleo, 51 da interface e HTML de 434.763 bytes.

## Política dos indicadores (D-063 a D-065)

| Indicador | Definição |
|---|---|
| Receita bruta | Σ totais das vendas registradas em `[desde, ate)`, com o preço capturado na venda |
| Devoluções | Σ totais das vendas **estornadas** em `[desde, ate)`, pela data do estorno, mesmo que a venda seja anterior |
| Receita após devoluções | Bruta − devoluções; pode ser negativa |
| CMV estimado | CMV capturado das vendas − CMV capturado das devoluções do período |
| Margem bruta / % | Receita após devoluções − CMV; % sobre a receita após devoluções, N/D se ≤ 0 |
| Ticket médio | Receita bruta ÷ nº de vendas do período, N/D sem vendas |
| Perdas | Unidades PERDA × custo gravado, por categoria; separadas de vendas e ajustes |
| Estoque agora | Retrato **atual** (saldo × custo de referência vigente), rotulado assim |

Fuso `America/Sao_Paulo` como UTC−03:00 nos dois lados. Exemplos de fronteira cobertos por testes: venda às 23:59:59,999 local fica no dia; à meia-noite, no dia seguinte; venda no dia 10 estornada no dia 12 (dia 10: +1.980; dia 12: −1.980; período 10–12: 0). Indicadores leem o estado completo validado, não a lista limitada de vendas, e excluem pendências (com aviso). Valores fora do intervalo exato retornam `INDICADOR_FORA_DO_LIMITE`.

## Funcionalidades

**Núcleo:** `src/domain/indicadores.js` (puro), `consultarIndicadores` e `gerarResumoDiario` em `casos-de-uso.js`, regra de reposição extraída numa função compartilhada. `consultarIndicadores` entrou no despacho (19 ações); o resumo não. CLI: `indicadores --de --ate` e `resumo [--dia]`. Medição inclui os indicadores.

**Interface:**
- `/visao-geral` (página inicial): períodos Hoje, 7 dias, 30 dias, Este mês e Personalizado (validado antes de enviar); barra de progresso ao trocar de período, mantendo os números anteriores na tela.
- 8 KPIs com número animado até o valor do núcleo, fórmula expansível (`aria-expanded`/`aria-controls`), tom de alerta para negativos, N/D quando o núcleo devolve nulo, e detalhamento: "Ver vendas do período" abre `/vendas?desde&ate`, já filtrado no núcleo.
- Gráfico SVG próprio por dia (receita e devoluções, nº de vendas ou perdas): dica ao passar o mouse, setas/Home/End no teclado com anúncio em `role="status"`, e tabela alternativa.
- Ranking dos produtos com barras animadas, reposição sugerida e perdas por motivo (barra empilhada e legenda com valores).
- Explicação das fórmulas e contagem de IDs de origem.
- **Layout:** menu lateral verde-escuro com ícones próprios; gaveta deslizante no celular (Esc fecha); marca com traço de "pulso"; paleta de comandos Ctrl+K/⌘K/"/" com busca sem acento em páginas, ações e produtos, setas e Enter; esqueletos de carregamento; cartões com elevação. Novo par de contraste (`destaque` sobre `verde-escuro`) entrou no teste AA.

## Verificações executadas

Node 22.23.5, npm 10.9.9; Angular 22.3.0, TypeScript 6.0.3, Tailwind 4.3.5.

| Controle | Resultado |
|---|---|
| `npm test` | 548 aprovados (36 em `indicadores.test.js`, 5 em `site-estatico.test.js`), 0 falhas |
| `npm run check` / `typecheck` | 49 arquivos sem erro; duas configurações aprovadas |
| `npm run demo` | Saldo e recálculo independente 10 |
| `npm run interface:typecheck` / `interface:test` | Strict aprovado; 74 testes em 9 arquivos (23 novos) |
| `npm run interface:build` | HTML único de 499.269 bytes (487,6 KiB); aviso de orçamento (450 kB), sem erro |
| Fumaça HTTP | GET 200 com CSP, 0 referências externas; `consultarIndicadores` pelo shim: 2 vendas, bruta 800, devoluções 600, resultado 200, 9 dias |
| Mutações | Núcleo 179 (173 + 6 equivalentes); interface 37/37 |
| Site estático | 1,5 MB; fumaça em jsdom com o bundle real: Visão geral renderizada, venda salva no `localStorage` (D-069) |

Os testes novos do núcleo cobrem: fuso e meia-noite; limites inclusivo/exclusivo; base vazia e período sem vendas (T16); valores com vários itens (T15); preço/custo alterados depois; venda e estorno no mesmo período e em períodos distintos; período só com estornos; perdas por categoria, ajustes, entradas, estoque atual; mesma regra de reposição; 130 vendas, além do limite de 100 da lista; **reconciliação independente** calculada diretamente das tabelas confirmadas, com uma venda pendente que não pode entrar; adulteração; estouro numérico; 10 períodos inválidos; consultas que não gravam nada; resumo diário (reconciliação com os indicadores, dia parcial, pendências e dias inválidos); despacho; CLI.

Os testes novos da interface cobrem: conversão de dias e presets; pedido inicial com o período certo; números do núcleo sem recálculo; N/D e negativos; troca de período mantendo valores; validação do período personalizado; fórmula acessível; link de detalhamento com o período; gráfico (barras, teclado, anúncio, métrica e tabela); avisos e falha com nova tentativa; paleta (atalhos, busca sem acento, setas, Enter, Esc, "/" dentro de campo); filtro da lista de vendas; gaveta do menu.

## Desempenho

Mesmo cenário sintético de 90 dias, 3 aquecimentos e 20 amostras, sem outras cargas ([evidência](evidencias/desempenho-fase03.json)). `consultarIndicadores` sobre um ano: mediana de **32,9 ms** com 8 leituras, comparável a `listarVendas` (29,2 ms). As demais operações ficaram na faixa da Fase 2. São números locais em JSONL e não indicam o desempenho no Google.

## Mutações

- **Núcleo:** 179 defeitos, 173 detectados e as mesmas 6 equivalentes já justificadas (MUT-10, 11, 37, 115, 123, 155); saída 0. Os 16 novos (MUT-164 a 179) cobrem: data da venda e do estorno, fim exclusivo, fuso, margem % e ticket N/D, receita negativa, CMV das devoluções, limite numérico, limite de 366 dias, perdas versus ajustes, dia em andamento do resumo, ação no despacho e contadores de estorno.
- **Interface:** 37 defeitos, 37 detectados; saída 0. Os 11 novos (MUI-27 a 37) cobrem: conversão de período e fuso, N/D no KPI, período enviado ao núcleo, link de detalhamento, teclado do gráfico, Enter e acentos na paleta, filtro de vendas, validação do período personalizado e manutenção dos valores durante a recarga.
- A primeira bateria da interface foi invalidada por um defeito do executor (cores ANSI do Vitest) e refeita após a correção (D-070).

## Arquivos

Núcleo: `src/domain/indicadores.js` (novo), `src/application/casos-de-uso.js`, `despacho.js`, `src/pulso.js`, `tipos/contratos.d.ts`. Local: `cli.js`, `medir-desempenho.js`, `mutacao.js` (+16 alvos), `mutacao-interface.js` (+11 alvos e `--verificar-alvos`). Testes: `tests/indicadores.test.js` (novo), `apoio.js` (relógio opcional), `fluxo`, `interface-local` e `contraste`.

Interface: `nucleo/periodo.ts`, `paginas/visao-geral.ts`, `ui/kpi.ts`, `ui/grafico-serie.ts`, `ui/icone.ts`, `ui/paleta-comandos.ts` e seus testes (novos); `app.ts`, `app.routes.ts`, `contratos.ts`, `pulso-api.ts`, `vendas.ts`, `carga.ts`, `styles.css` e acabamento em produtos, reposição e fornecedores.

## Limitações e próximo passo

- Resumo diário sem agenda, sem registro persistido e sem entrega (D-066).
- Nada foi visto num navegador real: layout nas quatro larguras, foco visível, rolagem e animações continuam sem evidência visual (D-068).
- O HTML único cresceu cerca de 64 kB e passou do aviso do orçamento (D-067).
- Fuso fixo em UTC−03:00 (D-064).
- Continuam os limites anteriores: leitura integral das tabelas, trava órfã manual, arquivo truncado sem reparo automático e ausência de proteção criptográfica.

Próximo passo em [PROMPT_PROXIMA_EXECUCAO.md](PROMPT_PROXIMA_EXECUCAO.md): resumo programado auditável com porta de entrega falsa, depois a Fase 4.
