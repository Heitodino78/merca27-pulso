# PULSO — Gestão Operacional MERCA 27

> **Demonstração educacional.** A MERCA 27 é um mercado fictício e todos os dados são sintéticos. O PULSO não é sistema fiscal, contábil nem produto pronto para uso empresarial real.

**Estado atual: Fase 00 concluída localmente.** O fluxo **cadastro → entrada → consulta de saldo** funciona por linha de comando, com testes automatizados. A integração com Google Sheets e Apps Script **ainda não foi feita**.

## Requisitos

- Node.js 22 ou superior (testado somente na versão 24.22.3). Não há dependências externas, então `npm install` não é necessário.

## Como executar

```bash
npm test            # testes automatizados
npm run check       # verificação de sintaxe
npm run demo        # demonstração do primeiro marco, em pasta temporária

npm run -s pulso -- seed
npm run -s pulso -- produtos
npm run -s pulso -- entrada --sku MER-001 --quantidade 10 --referencia NF-TESTE-1
npm run -s pulso -- saldo --sku MER-001
npm run -s pulso -- cadastrar --sku MER-007 --nome "Produto Teste" --categoria MERCEARIA --preco 990 --custo 600 --minimo 5 --alvo 12
npm run -s pulso -- reconciliar
```

Preço e custo são informados em centavos. Os dados ficam em `data/`, que não é versionada; use a variável `PULSO_DADOS` para escolher outra pasta. Para repetir uma entrada com segurança, informe o mesmo `--requisicao ID`.

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
- Cada escrita segue a ordem intenção → dado → confirmação, com releitura após cada gravação.
- Repetir a mesma requisição não duplica. Reutilizá-la com dados diferentes é rejeitado.
- Operação interrompida bloqueia novos lançamentos até ser concluída por repetição ou `reconciliar`.
- Registros editados, apagados ou copiados à mão são detectados na leitura (`DADOS_INCONSISTENTES`).

## Limitações

- Sem Google Sheets, Apps Script, sidebar ou menu nesta fase; a interface é a CLI.
- Sem venda, perda, ajuste, alerta de reposição, fornecedores ou dashboard.
- Quem apagar uma operação inteira de forma coerente em todos os arquivos não será detectado, pois não há cadeia de hashes.
- Se um processo for encerrado à força durante uma operação, o arquivo `.pulso.lock` precisa ser removido manualmente. A mensagem de erro indica o caminho.

Mais detalhes em [docs/RELATORIO_FASE_00.md](docs/RELATORIO_FASE_00.md).
