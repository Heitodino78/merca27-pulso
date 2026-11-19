# PULSO — Gestão Operacional MERCA 27

> **Demonstração educacional.** A MERCA 27 é um mercado fictício e todos os dados são sintéticos. O PULSO não é sistema fiscal, contábil nem produto pronto para uso empresarial real.

**Estado atual: Fase 01 concluída localmente.** Produtos, fornecedores, entradas, perdas, contagens, histórico de versões e reposição funcionam pela CLI, com 343 testes aprovados. Interface visual e integração Google continuam pendentes.

## Requisitos

- Node.js 22 ou superior (testado nas versões 22.23.5 e 24.22.3).
- Dependências somente de desenvolvimento: `typescript@5.9.3` e `@types/node@22.20.5`. Execute `npm ci` para instalá-las e `npm run typecheck` para conferir `src/` e `local/`, sem build. A operação por CLI não exige essas dependências.
- `.npmrc` define `bin-links=false` para o volume vfat; o compilador é chamado diretamente por Node. Nenhuma instalação global é necessária.

Nesta máquina, Node/npm não estão no PATH padrão. A revisão usou um runtime oficial temporário em `/tmp/merca27-runtime/node-v22.23.5-linux-x64`, com SHA-256 conferido. Enquanto essa pasta existir, execute `export PATH=/tmp/merca27-runtime/node-v22.23.5-linux-x64/bin:$PATH` antes dos comandos abaixo. Isso não é uma instalação permanente.

## Como executar

```bash
npm test            # testes automatizados
npm run check       # verificação de sintaxe
npm run typecheck   # contratos JSDoc; exige npm ci
npm run mutacao     # 108 defeitos em cópias temporárias; leva cerca de 15 minutos
npm run medir       # cenário temporário de 90 dias; tempos e volume em JSON
npm run demo        # demonstração do primeiro marco, em pasta temporária

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
npm run -s pulso -- reposicao
npm run -s pulso -- historico-produto --sku MER-001
npm run -s pulso -- reconciliar
```

Preço, custo de referência e custo unitário de entrada são informados em centavos. Entrada exige `--custo` (zero para bonificação) e `--fornecedor`. Os dados ficam em `data/`, que não é versionada; use `PULSO_DADOS` para escolher outra pasta. Para repetir uma entrada, use o mesmo `--requisicao ID` e os mesmos dados. Uma entrada nova usa outra chave. O custo da entrada não altera automaticamente o custo de referência.

`npm run demo` valida os próprios resultados e termina com erro se alguma expectativa falhar. Usa uma pasta temporária, sem alterar `data/`. A seed e os resultados esperados estão em [fixtures/SEED_README.md](fixtures/SEED_README.md).

## Estrutura

```text
src/                 Núcleo portável, sem APIs do Node (destino: Apps Script)
  domain/            Regras puras: validação, Produto, Movimento, saldo
  application/       Casos de uso e protocolo de gravação
  infra/             Esquema das tabelas e repositório
  pulso.js           Montagem do núcleo a partir das portas do ambiente
local/               Somente para esta máquina: JSONL, trava, CLI, demo, gerador
fixtures/            Catálogo sintético reproduzível (semente 27)
tests/               Testes automatizados
docs/                Documentos-base, decisões, progresso, testes e relatório
```

## Como a integridade é garantida

- O saldo nunca é armazenado: é a soma dos movimentos de operações confirmadas.
- O armazenamento só oferece `ler` e `anexar`, então o fluxo normal não edita nem apaga histórico.
- Cada escrita segue a ordem intenção → dado → confirmação, com releitura e comparação de todo o conteúdo após cada gravação.
- Repetir a mesma requisição não duplica. Reutilizá-la com dados diferentes é rejeitado.
- Antes de novo lançamento, a pendência anterior é reconciliada automaticamente dentro da trava; falha impede iniciar a nova operação. Repetição com a mesma chave e `reconciliar` também continuam disponíveis.
- Divergências entre registros e intenções, duplicidades, referências e estados inválidos são detectados na leitura (`DADOS_INCONSISTENTES`). A reconciliação relê o estado final antes de anunciar conclusão.
- Quantidades e saldos devem permanecer no intervalo de inteiros exatos do JavaScript. Uma entrada que ultrapassaria esse limite é rejeitada antes de criar intenção.
- A leitura comum dispensa a trava. Se encontrar inconsistência, repete uma única vez com trava antes de devolver erro. As gravações continuam serializadas e verificadas por releitura completa.
- Os saldos usados na projeção são mapas temporários reconstruídos dos movimentos confirmados; nenhum saldo é persistido como fonte independente.

## Situação do Google

Na revisão de 18/11/2026, o conector Google Drive respondeu às buscas `MERCA` e `PULSO`, sem resultados. Isso comprova acesso ao conector, mas não execução do núcleo em Apps Script. Não há ferramenta de execução de Apps Script, `clasp` instalado nem configuração local dele nos caminhos verificados. Nenhum recurso Google foi criado ou alterado. O núcleo mantém portas para um futuro adaptador; a validação real no Google continua pendente.

## Limitações

- Sem Google Sheets, Apps Script, sidebar ou menu nesta fase; a interface é a CLI.
- Sem vendas, estornos, dashboard, lotes, validade, automações periódicas ou compra automática. Reversão de perdas e ajustes foi adiada para a Fase 2.
- Bases da Fase 00 não são migradas nem apagadas automaticamente. Preserve o histórico antigo e escolha uma pasta nova com `PULSO_DADOS` para o esquema da Fase 01.
- Alterações coerentes de todo o histórico podem não ser detectadas: as comparações não são uma assinatura criptográfica. Não há cadeia de hashes nem cópia externa de auditoria.
- Uma interrupção real durante a escrita pode deixar uma linha incompleta. Ela é detectada e bloqueia a operação; não há reparo automático de arquivo truncado.
- Se um processo for encerrado à força durante uma operação, o arquivo `.pulso.lock` precisa ser removido manualmente. A mensagem de erro indica o caminho.

Detalhes atuais em [docs/RELATORIO_FASE_01.md](docs/RELATORIO_FASE_01.md), comandos e evidências em [docs/TESTES.md](docs/TESTES.md). A [Fase 00](docs/RELATORIO_FASE_00.md) permanece como registro histórico.
