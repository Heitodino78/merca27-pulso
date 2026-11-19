# PULSO — próxima execução: concluir a Fase 3 (resumo programado) e preparar a Fase 4

**Referência em 19/11/2026:** branch `fase-03-dashboard`. Fases 00/01, M-03, Fase 2 e a parte local da Fase 3 (indicadores, visão geral e resumo diário sob demanda) estão implementadas e verificadas localmente. M-06 continua parcial por falta de navegador real. Integração Google continua pendente. Este prompt descreve a próxima execução.

## Missão

1. Fechar a Fase 3: execução programada do resumo diário com registro auditável de tentativas, chave idempotente por dia e porta de entrega falsa, tudo testável localmente com relógio controlado (D-066).
2. Começar a Fase 4 só depois disso: acabamento de usabilidade e case de portfólio, sem prometer integração Google, navegador ou envio real sem evidência.

## 1. Leitura e estado real

Leia integralmente README, `interface/README.md`, `fixtures/SEED_README.md`, `docs/RELATORIO_FASE_03.md`, `RELATORIO_FASE_02.md`, `RELATORIO_INTERFACE.md`, `PROGRESSO.md`, `DECISOES.md` (especialmente D-063 a D-069), `TESTES.md` e `MELHORIAS_PLANEJADAS.md`. Leia os cinco documentos-base v1.1.0; seus estados e contagens antigos são divergências históricas (D-054). Leia todo o código próprio de `src/`, `local/`, `tipos/`, `tests/` e `interface/src/`. Código e testes executados prevalecem sobre números deste prompt.

Estado de referência:

- Núcleo em scripts globais `var PULSO`, sem imports nem build. Oito tabelas (esquema em `src/infra/esquema.js`). Protocolo M-03 `{ registros }` com releitura de cada escrita; `TIPOS_LEGADOS` fixos; `fixtures/base-fase01/` imutável.
- `src/domain/indicadores.js`: agregação pura sobre o estado reproduzido. Política temporal por data do evento (D-063), fuso UTC−03:00 (D-064), definições e `INDICADOR_FORA_DO_LIMITE` (D-065). `consultarIndicadores({ desde, ate })` está no despacho (19 ações). `gerarResumoDiario({ dia })` não está no despacho e não grava nada.
- CLI: `indicadores --de --ate` (dias locais inclusivos) e `resumo [--dia]`.
- Interface: `/visao-geral` é a inicial; componentes próprios `kpi`, `grafico-serie`, `icone`, `paleta-comandos`; `nucleo/periodo.ts` converte dias locais em instantes UTC com `RELOGIO` injetável. Lista de vendas aceita `?desde&ate`. HTML único ≈ 499 kB (aviso do orçamento de 450 kB mantido de propósito, erro em 600 kB).
- Referência: 548 testes do núcleo, 74 da interface, 179 alvos de mutação no núcleo e 37 na interface. Confirme os números antes de reutilizá-los.

## 2. Ambiente, preservação e linha de base

Node/npm podem estar fora do PATH. Se `/tmp/merca27-runtime/node-v22.23.5-linux-x64/bin` não existir, baixe o tarball oficial e confira o SHA-256 `cdeb8670…40f8` (TESTES.md), sem instalação global. Volume vfat com `showexec` e `bin-links=false`; `npm ci --ignore-scripts --no-audit --no-fund` na raiz e `npm run interface:instalar` se faltar `interface/node_modules`. Crie uma branch a partir de `fase-03-dashboard`. Antes de alterar: `npm test`, `check`, `typecheck`, `demo`, `interface:typecheck`, `interface:test`, `interface:build`, `mutacao -- --verificar-alvos` e `interface:mutacao -- --verificar-alvos`.

Baterias completas (`npm run mutacao`, `npm run interface:mutacao`) em marcos/final, nunca concorrentes com testes, builds ou medição. Sobrevivente sem justificativa, alvo ausente ou erro de execução é falha. Commits locais por fatia: `git -c user.name="PULSO Dev" -c user.email="dev@merca27.invalid" commit`. Sem push, merge em `main` ou publicação.

## 3. Resumo diário programado (fechar a Fase 3)

- Registre uma decisão antes de codificar: tabela nova (ex.: `RESUMOS_DIARIOS`, chave `RES-<dia>`), tipo de operação novo (ex.: `RESUMO_DIARIO`), requisição idempotente determinística por dia (ex.: `RESUMO-DIARIO-2026-11-19`) e o que a linha guarda (dia, instante de geração, totais principais). Nunca adicione o tipo novo a `TIPOS_LEGADOS`.
- Amplie esquema, `dobrarOperacoes`, `conferirIntencao` e a reprodução: ao reproduzir a operação, os totais gravados devem bater com a agregação do estado naquele ponto do log. Teste adulteração, falhas antes/depois/silenciosas em cada registro e recuperação.
- Separe "gerar e registrar" de "entregar": uma porta `entrega` falsa (em memória) recebe o texto; sucesso de entrega não pode ser presumido. Defina e teste o que acontece se a entrega falhar depois de registrar.
- Simule a agenda com relógio controlado: repetição do mesmo dia não duplica; dias distintos geram registros distintos; concorrência real com processos; resumo com pendência. CLI de execução manual. Sem trigger real, destinatários ou e-mail sem instrução explícita do proprietário.
- Se a interface ganhar acesso ao histórico de resumos, acrescente só a ação de leitura necessária ao despacho.

## 4. Fase 4 (se houver espaço)

Reversão administrativa de perdas/ajustes/contagens continua pendente (D-058) e merece fatia própria. Acabamento: tela de contagem de inventário (o núcleo já existe), estados vazios mais guiados, ajuda breve, exportação simples (CSV) dos indicadores. Avaliar reduzir o HTML único (por exemplo, retirar código morto) e registrar o tamanho final.

## 5. M-06 e Google

Não repetir chamadas de navegador negadas (D-047, D-054, D-061, D-068). Se o proprietário autorizar um caminho, validar o HTML único em 360, 390, 768 e 1440 px, teclado, foco, movimento reduzido, a visão geral (gráfico, paleta, gaveta) e as jornadas de venda/estorno, e salvar capturas em `docs/capturas/`. Google só com autorização efetiva para executar Apps Script; o conector Drive sozinho não basta.

## 6. Entrega

Atualize README, PROGRESSO, DECISOES, TESTES, MELHORIAS_PLANEJADAS e relatórios pertinentes. Crie o relatório da execução com arquivos, decisões, comandos e resultados, desempenho e limitações reais. Reescreva este prompt para o passo seguinte. Fora de escopo: fiscal, pagamentos reais, lotes/FEFO, descontos, estornos parciais, compra automática, banco remoto, autenticação própria, IA e publicação.
