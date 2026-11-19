# PULSO — Gestão Operacional MERCA 27

> **Demonstração educacional.** A MERCA 27 é um mercado fictício e todos os dados são sintéticos. O PULSO não é sistema fiscal, contábil nem produto pronto para uso empresarial real.

**Estado atual: Fase 2 local, com vendas de vários itens e estorno total.** Produtos, fornecedores, entradas, perdas, contagens, versões e reposição continuam disponíveis. Vendas, histórico e estornos funcionam pela CLI e pela interface Angular + Tailwind. A validação em navegador real de M-06 e a integração Google continuam pendentes ([relatório da Fase 2](docs/RELATORIO_FASE_02.md)). Resultados executados em [TESTES.md](docs/TESTES.md).

## Requisitos

- Node.js 22 ou superior (testado nas versões 22.23.5 e 24.22.3).
- Dependências somente de desenvolvimento: `typescript@5.9.3` e `@types/node@22.20.5`. Execute `npm ci` para instalá-las e `npm run typecheck` para conferir `src/` e `local/`, sem build. A operação por CLI não exige essas dependências.
- `.npmrc` define `bin-links=false` para o volume vfat; o compilador é chamado diretamente por Node. Nenhuma instalação global é necessária.

- Interface: dependências próprias em `interface/` (Angular 22.3.0, TypeScript 6.0.3, Tailwind CSS 4.3.5), instaladas com `npm run interface:instalar`. O volume é montado com `showexec` e não executa binários; `local/interface.js` roda o esbuild a partir de uma cópia na pasta temporária (D-042).

Nesta máquina, Node/npm não estão no PATH padrão. A revisão usou um runtime oficial temporário em `/tmp/merca27-runtime/node-v22.23.5-linux-x64`, com SHA-256 conferido. Enquanto essa pasta existir, execute `export PATH=/tmp/merca27-runtime/node-v22.23.5-linux-x64/bin:$PATH` antes dos comandos abaixo. Isso não é uma instalação permanente.

## Como executar

```bash
npm test            # testes automatizados
npm run check       # verificação de sintaxe
npm run typecheck   # contratos JSDoc; exige npm ci
npm run mutacao     # defeitos em cópias temporárias; execução demorada
npm run mutacao -- --verificar-alvos   # só confere que cada alvo de mutação existe
npm run medir       # cenário temporário de 90 dias; tempos e volume em JSON
npm run demo        # demonstração do primeiro marco, em pasta temporária

npm run interface:instalar   # dependências da interface (uma vez)
npm run interface:build      # HTML único: interface/dist/html-service/Interface.html
npm run interface:test       # componentes, transporte e estados da interface
npm run interface:typecheck  # TypeScript strict da interface
npm run interface:mutacao    # defeitos na interface, em cópias temporárias
PULSO_DADOS=/tmp/pulso-demo npm run interface:preview -- --seed   # http://127.0.0.1:4827/

npm run -s pulso -- seed
npm run -s pulso -- produtos
npm run -s pulso -- entrada --sku MER-001 --quantidade 10 --custo 600 --fornecedor FOR-001 --referencia NF-TESTE-1 --requisicao EXEMPLO-ENTRADA-001
npm run -s pulso -- saldo --sku MER-001
npm run -s pulso -- cadastrar --sku MER-041 --nome "Produto Teste" --categoria MERCEARIA --preco 990 --custo 600 --minimo 5 --alvo 12 --fornecedor FOR-001
npm run -s pulso -- fornecedores
npm run -s pulso -- cadastrar-fornecedor --fornecedor FOR-007 --nome "Distribuidora Fictícia" --categoria MERCEARIA --prazo 3
npm run -s pulso -- alterar-produto --sku MER-001 --preco 1200 --motivo "Revisão fictícia"
npm run -s pulso -- desativar --sku MER-001 --motivo "Pausa fictícia"
npm run -s pulso -- reativar --sku MER-001 --motivo "Retorno fictício"
npm run -s pulso -- saldo-inicial --sku MER-041 --quantidade 7 --custo 600 --motivo "Inventário fictício"
npm run -s pulso -- perda --sku MER-041 --quantidade 2 --categoria-perda AVARIA --motivo "Avaria fictícia"
npm run -s pulso -- ajuste --sku MER-041 --contada 4 --motivo "Contagem fictícia"
npm run -s pulso -- contagem --item MER-001=7 --item MER-002=0 --motivo "Inventário fictício"
npm run -s pulso -- venda --item MER-001=2 --pagamento PIX --requisicao EXEMPLO-VENDA-001
npm run -s pulso -- vendas
npm run -s pulso -- venda --id VEN-...  # use o ID devolvido pelo comando venda
npm run -s pulso -- estorno --venda VEN-... --motivo "Devolução fictícia" --requisicao EXEMPLO-ESTORNO-001
npm run -s pulso -- reposicao
npm run -s pulso -- historico-produto --sku MER-001
npm run -s pulso -- reconciliar
```

Preço, custo de referência e custo unitário de entrada são informados em centavos. Entrada exige `--custo` (zero para bonificação) e `--fornecedor`. Os dados ficam em `data/`, que não é versionada; use `PULSO_DADOS` para escolher outra pasta. Para repetir uma entrada, use o mesmo `--requisicao ID` e os mesmos dados. Uma entrada nova usa outra chave. O custo da entrada não altera automaticamente o custo de referência.

A pré-visualização serve o HTML único e simula `google.script.run` chamando os mesmos casos de uso. Ouve só em `127.0.0.1`. Use `--falhas-simuladas` para testar repetição após falha e `PULSO_PREVIEW_ATRASO_MS` para ver o estado de carregamento. **Ela não é integração com o Google.**

Venda aceita de 1 a 50 itens, cada SKU uma única vez, com quantidade inteira positiva. Se qualquer item for inválido ou não tiver saldo, a venda inteira é recusada. `DINHEIRO`, `PIX` e `CARTAO` são campos informativos. Preço e custo de referência são capturados pelo núcleo na confirmação, em centavos; o total da revisão visual é apenas para conferência. Repetir a mesma requisição com os mesmos itens, mesmo em outra ordem, devolve a venda existente. O estorno é total e único, exige motivo e devolve todas as unidades como revendáveis, sem apagar a venda. Devoluções parciais, taxas e pagamentos reais ficam fora deste protótipo.

No núcleo, `listarVendas({ desde?, ate?, limite? })` usa ISO UTC, início inclusivo e fim exclusivo, e retorna até 100 vendas por padrão (máximo 500). `consultarVenda` aceita exatamente um de `vendaId` ou `requisicaoId`. A busca da interface filtra a lista carregada; para um ID fora dela, abra `/#/vendas/ID` ou consulte pelo núcleo/CLI.

`npm run demo` valida os próprios resultados e termina com erro se alguma expectativa falhar. Usa uma pasta temporária, sem alterar `data/`. A seed e os resultados esperados estão em [fixtures/SEED_README.md](fixtures/SEED_README.md).

## Estrutura

```text
src/                 Núcleo portável, sem APIs do Node (destino: Apps Script)
  domain/            Regras puras: validação, Produto, Movimento, saldo
  application/       Casos de uso e protocolo de gravação
  infra/             Esquema das tabelas e repositório
  pulso.js           Montagem do núcleo a partir das portas do ambiente
  application/despacho.js  Ações expostas à interface (HTML Service e pré-visualização)
local/               Somente para esta máquina: JSONL, trava, CLI, demo, gerador,
                     pré-visualização, empacotamento e execução do Angular
interface/           Angular + Tailwind; vira um único HTML para o HTML Service
fixtures/            Catálogo sintético reproduzível (semente 27)
tests/               Testes automatizados
docs/                Documentos-base, decisões, progresso, testes e relatório
```

## Como a integridade é garantida

- O saldo nunca é armazenado: é a soma dos movimentos de operações confirmadas.
- O armazenamento só oferece `ler` e `anexar`, então o fluxo normal não edita nem apaga histórico.
- Cada escrita segue a ordem intenção → dados → confirmação, com releitura e comparação de todo o conteúdo após cada gravação. Uma operação pode gravar vários registros (M-03); confirmada, precisa ter todos, exatamente iguais à intenção. Logs da Fase 01, com um registro por intenção, continuam legíveis.
- Repetir a mesma requisição não duplica. Reutilizá-la com dados diferentes é rejeitado.
- Antes de novo lançamento, a pendência anterior é reconciliada automaticamente dentro da trava; falha impede iniciar a nova operação. Repetição com a mesma chave e `reconciliar` também continuam disponíveis.
- Divergências entre registros e intenções, duplicidades, referências e estados inválidos são detectados na leitura (`DADOS_INCONSISTENTES`). A reconciliação relê o estado final antes de anunciar conclusão.
- Quantidades e saldos devem permanecer no intervalo de inteiros exatos do JavaScript. Uma entrada que ultrapassaria esse limite é rejeitada antes de criar intenção.
- A leitura comum dispensa a trava. Se encontrar inconsistência, repete uma única vez com trava antes de devolver erro. As gravações continuam serializadas e verificadas por releitura completa.
- Os saldos usados na projeção são mapas temporários reconstruídos dos movimentos confirmados; nenhum saldo é persistido como fonte independente.

## Situação do Google

Na revisão de 18/11/2026, o conector Google Drive respondeu às buscas `MERCA` e `PULSO`, sem resultados. Isso comprova acesso ao conector, mas não execução do núcleo em Apps Script. Não há ferramenta de execução de Apps Script, `clasp` instalado nem configuração local dele nos caminhos verificados. Nenhum recurso Google foi criado ou alterado. O núcleo mantém portas para um futuro adaptador; a validação real no Google continua pendente.

Em 19/11/2026 (M-06), o conector Drive exigia autorização nesta sessão e continuava sem `clasp` ou outra forma de executar Apps Script. A interface já chama o servidor por `google.script.run.pulsoChamar(acao, pedido)`, e `PULSO.despacho.despachar` está pronto para essa função; o adaptador de Sheets não foi implementado.

## Limitações

- Sem Google Sheets, Apps Script, sidebar ou menu. A interface roda só na pré-visualização local e ainda não foi verificada em navegador real nem no HTML Service.
- Sem dashboard, lotes, validade, automações periódicas ou compra automática. A reversão compensatória de perdas e ajustes continua adiada, com justificativa em D-058.
- A contagem de inventário com vários SKUs existe no núcleo e na CLI, ainda sem tela na interface.
- Bases da Fase 00 não são migradas nem apagadas automaticamente. Preserve o histórico antigo e escolha uma pasta nova com `PULSO_DADOS` para o esquema da Fase 01.
- Alterações coerentes de todo o histórico podem não ser detectadas: as comparações não são uma assinatura criptográfica. Não há cadeia de hashes nem cópia externa de auditoria.
- Uma interrupção real durante a escrita pode deixar uma linha incompleta. Ela é detectada e bloqueia a operação; não há reparo automático de arquivo truncado.
- Se um processo for encerrado à força durante uma operação, o arquivo `.pulso.lock` precisa ser removido manualmente. A mensagem de erro indica o caminho.

Detalhes atuais em [docs/RELATORIO_FASE_02.md](docs/RELATORIO_FASE_02.md) e [docs/RELATORIO_INTERFACE.md](docs/RELATORIO_INTERFACE.md), comandos e evidências em [docs/TESTES.md](docs/TESTES.md). Os relatórios de [M-03](docs/RELATORIO_M03.md), [Fase 01](docs/RELATORIO_FASE_01.md) e [Fase 00](docs/RELATORIO_FASE_00.md) permanecem como registros históricos.
