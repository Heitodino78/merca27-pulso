# Relatório de execução — M-06, interface Angular + Tailwind

**Data:** 19/11/2026 · **Branch:** `interface-angular` (criada a partir de `fase-01`) · **Ambiente:** exclusivamente local.

## Resultado

**M-06 está parcialmente concluída.** A interface foi implementada, compilada num HTML único compatível com o HTML Service e coberta por testes automatizados, com mutações. **Faltam a verificação em navegador real e as capturas de tela**, que são critérios de aceite: as três formas de abrir um navegador neste ambiente foram bloqueadas (seção "Navegador"). Por isso M-06 **não** está marcada como concluída. A integração Google continua pendente por falta de acesso efetivo.

Nada foi publicado, enviado ao remoto ou criado no Google. Todos os dados usados são fictícios.

## O que foi feito

| Área | Entrega |
|---|---|
| Stack | Angular 22.3.0 (standalone, signals, zoneless, `@if`/`@for`, formulários reativos tipados), TypeScript 6.0.3 strict só em `interface/`, Tailwind CSS 4.3.5 via `@tailwindcss/postcss`. Versões exatas no lockfile (D-041) |
| Telas | Produtos (busca, filtro, marcação de reposição), cadastro, detalhe com saldo, histórico de movimentos, versões do cadastro, alteração, desativação e reativação; entrada; saldo inicial, perda e ajuste por contagem; reposição sugerida; fornecedores (somente leitura) |
| Estados | Vazio, carregando, sucesso, falha (nada gravado), falha incerta (pode ter gravado), conflito de chave e reconciliação pendente, com aviso global e botão "Reconciliar agora" |
| Integridade na tela | `requisicaoId` por tentativa lógica, repetição com a mesma chave e os mesmos dados, conflito exibido, clique duplo bloqueado (botão, `fieldset` e controle), sucesso só após `ok: true` do núcleo (D-045) |
| Acessibilidade | Rótulos em todos os campos, `aria-describedby` para dica e erro, `aria-invalid`, foco no primeiro campo inválido, no resultado do envio e no título ao trocar de página, link "Pular para o conteúdo", `prefers-reduced-motion` e alvos de 44 px |
| Identidade | Cores do Documento Mestre como tokens `@theme`; contraste AA conferido por teste; âmbar só como fundo ou borda, com texto escuro |
| HTML Service | Rotas por hash, sem `<base>`, sem carregamento tardio, sem CDN; `local/empacotar-interface.js` gera `interface/dist/html-service/Interface.html` (404.363 bytes, 395 KiB) e recusa chunks, recursos externos e conteúdo que fecharia a tag (D-043) |
| Servidor | `src/application/despacho.js`: lista fechada de 14 ações, chamada por `pulsoChamar` no Apps Script e pela pré-visualização (D-044) |
| Pré-visualização | `local/servidor-preview.js`, somente em `127.0.0.1`, com `google.script.run` simulado, verificação de Host e Origin, CSP restritiva e falhas simuladas opcionais (`--falhas-simuladas`). Não é integração Google |

## Arquivos

| Grupo | Arquivos |
|---|---|
| Núcleo | `src/application/despacho.js` (novo), `tipos/contratos.d.ts` |
| Ferramentas locais | `local/interface.js`, `local/empacotar-interface.js`, `local/servidor-preview.js`, `local/mutacao-interface.js` (novos), `local/mutacao.js` (+5 mutações) |
| Interface | `interface/` inteiro: `package.json`, `package-lock.json`, `.npmrc`, `.postcssrc.json`, `angular.json`, `tsconfig*.json`, `src/styles.css`, `src/app/**` (núcleo da interface, formulários, páginas, componentes e 5 arquivos de teste) |
| Testes da raiz | `tests/interface-local.test.js`, `tests/contraste.test.js` |
| Documentação | Este relatório, `README.md`, `interface/README.md`, `docs/DECISOES.md` (D-041 a D-048), `docs/TESTES.md`, `docs/PROGRESSO.md`, `docs/MELHORIAS_PLANEJADAS.md`, `docs/PROMPT_PROXIMA_EXECUCAO.md`, evidência `docs/evidencias/mutacao-interface.txt` |

## Comandos e resultados

Node 22.23.5 e npm 10.9.9, baixados do site oficial para `/tmp/merca27-runtime` com SHA-256 conferido (`cdeb8670…40f8`). Nada foi instalado globalmente.

| Comando | Resultado |
|---|---|
| Linha de base antes de alterar (`npm test`, `check`, `typecheck`, `demo`) | 343 testes aprovados, 35 arquivos, tipos e demonstração aprovados |
| `npm test` | **359 testes, 359 aprovados** (16 novos: 13 de despacho, servidor e empacotamento; 3 de contraste) |
| `npm run check` | 42 arquivos, 0 erros |
| `npm run typecheck` | Duas configurações aprovadas |
| `npm run demo` | Saldo 10, recálculo independente 10, um movimento |
| `npm run interface:test` | **39 testes aprovados** em 5 arquivos |
| `npm run interface:typecheck` | Aprovado com `strict`, `strictTemplates` e `noUncheckedIndexedAccess` |
| `npm run interface:build` | Bundle inicial de 403,78 kB (99,92 kB estimados na transferência); HTML único de 404.363 bytes |
| `npm run interface:mutacao` | **13 defeitos, 13 detectados por falha de teste** (nenhum só por erro de compilação) |
| `npm run mutacao` | 113 defeitos (108 anteriores e 5 novos no despacho): **110 detectados e 3 equivalentes justificados** (MUT-10, MUT-11 e MUT-37). Evidência em [mutacao-m06.txt](evidencias/mutacao-m06.txt) |
| Fumaça HTTP da pré-visualização com o build real e seed em pasta temporária | `GET /` 200, 396 KiB, 0 referências externas, shim antes do bundle, CSP presente; 40 produtos, 6 fornecedores; entrada de 10 e repetição `OPERACAO_DUPLICADA` com saldo 10 |

## Navegador e capturas: não executados

O prompt exige navegador real em 360, 390, 768 e 1440 px e capturas em `docs/capturas/`. Tentativas, todas sem sucesso:

1. **Firefox do sistema** via `flatpak-spawn --host`: o VS Code roda em Flatpak, e a chamada ao host foi **negada pela política de permissões** desta sessão.
2. **Maestri Portal:** a skill foi lida, mas o CLI `maestri` não existe neste ambiente (`MAESTRI_CLI` vazio).
3. **Chrome for Testing headless** baixado em `/tmp/merca27-navegador` (puppeteer-core): a **execução do binário foi negada** pela mesma política.

Nenhum bloqueio foi contornado. Por isso **não há capturas em `docs/capturas/`** e nenhuma inspeção em navegador é declarada. O comportamento foi verificado em jsdom (testes de componente) e por HTTP, o que **não substitui** o navegador: layout real nas quatro larguras, foco visível, rolagem e navegação por teclado completa continuam sem evidência.

Para concluir: autorizar um dos caminhos acima (por exemplo, permitir executar o Chromium em `/tmp/merca27-navegador`) e repetir o roteiro da seção 7 do prompt.

### Tentativa na execução seguinte (M-03, 19/11/2026)

O CLI do Maestri continuava ausente, e o proprietário não autorizou os outros dois caminhos; as chamadas negadas antes não foram repetidas. Os critérios de navegador e capturas continuam pendentes (D-054). A interface não mudou nesta execução, e seus 39 testes continuam aprovados.

## Situação do Google

- Conector Google Drive desta sessão: exige autorização e não carregou ferramentas.
- `clasp` ausente; sem `.clasprc.json` nem `.clasp.json`. Nenhuma ferramenta executa Apps Script.
- Conclusão: **sem acesso efetivo**. Adaptadores de Sheets, `LockService`, menu e testes na planilha **não foram implementados nem simulados**. O despacho e o transporte por `google.script.run` já estão prontos para receber o adaptador real.

## Limitações

- M-06 sem verificação em navegador nem capturas (acima).
- A chave de uma tentativa incerta sobrevive à navegação, mas não ao recarregamento da página (D-045).
- O HTML único tem 395 KiB, mais que a alternativa sem framework; nenhum limite do HTML Service foi medido em ambiente real.
- Módulo ES embutido (`<script type="module">`) e `crypto.randomUUID` não foram testados dentro do iframe real do HTML Service.
- Fornecedores ficam somente leitura; `cadastrarFornecedor` não é exposto à interface.
- Sem vendas, estorno, dashboard ou automações; M-03 continua pendente.
