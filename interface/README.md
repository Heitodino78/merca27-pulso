# Interface do PULSO (Angular + Tailwind CSS)

Telas do PULSO para o HTML Service do Apps Script, com pré-visualização local. Decisão em D-040; detalhes em [../docs/RELATORIO_INTERFACE.md](../docs/RELATORIO_INTERFACE.md).

Use sempre os comandos da raiz do repositório (o volume vfat não executa binários nativos; `local/interface.js` resolve isso):

```bash
npm run interface:instalar    # npm ci --ignore-scripts dentro de interface/
npm run interface:build       # ng build + HTML único em interface/dist/html-service/Interface.html
npm run interface:test        # testes unitários (Vitest + jsdom)
npm run interface:typecheck   # TypeScript strict
npm run interface:mutacao     # 13 defeitos em cópias temporárias
npm run interface:preview -- --seed   # http://127.0.0.1:4827/ (dados em PULSO_DADOS)
```

Regras: nenhuma regra de negócio nos componentes; somente rotas por hash; nada de carregamento tardio, CDN ou bibliotecas de componentes.
