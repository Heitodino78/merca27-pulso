# Interface do PULSO (Angular + Tailwind CSS)

Telas do PULSO para o HTML Service do Apps Script, com pré-visualização local. Decisão em D-040; detalhes em [../docs/RELATORIO_INTERFACE.md](../docs/RELATORIO_INTERFACE.md).

Use sempre os comandos da raiz do repositório (o volume vfat não executa binários nativos; `local/interface.js` resolve isso):

```bash
npm run interface:instalar    # npm ci --ignore-scripts dentro de interface/
npm run interface:build       # ng build + HTML único em interface/dist/html-service/Interface.html
npm run interface:test        # testes unitários (Vitest + jsdom)
npm run interface:typecheck   # TypeScript strict
npm run interface:mutacao     # 37 defeitos em cópias temporárias (-- --verificar-alvos só confere os alvos)
npm run interface:preview -- --seed   # http://127.0.0.1:4827/ (dados em PULSO_DADOS)
```

Regras: nenhuma regra de negócio nos componentes; somente rotas por hash; nada de carregamento tardio, CDN ou bibliotecas de componentes.

Fase 2: `/vendas`, `/vendas/nova` e `/vendas/:id` permitem buscar produtos, revisar vários itens, confirmar a venda, consultar o histórico e estornar integralmente com motivo. A confirmação mostra o total oficial do núcleo. Falha incerta mantém chave e pedido para repetir; sucesso encerra o formulário até escolher “Nova venda”. A busca do histórico cobre a lista carregada (até 100 vendas). A interface ainda exige a verificação em navegador real nas quatro larguras previstas em M-06.

Fase 3: `/visao-geral` é a página inicial. Período em dias de São Paulo (Hoje, 7 dias, 30 dias, Este mês ou Personalizado), convertido em instantes UTC em `nucleo/periodo.ts`; os números vêm prontos de `consultarIndicadores`. Componentes próprios em `ui/`: `kpi` (valor animado, fórmula expansível, link de detalhamento), `grafico-serie` (SVG com teclado e tabela alternativa), `icone` (SVG em traço) e `paleta-comandos` (Ctrl+K, ⌘K ou "/"). O layout tem menu lateral no desktop e gaveta no celular. Nenhuma biblioteca de gráficos ou componentes foi adicionada; o movimento respeita `prefers-reduced-motion`.
