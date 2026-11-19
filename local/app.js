'use strict';
/* Monta o PULSO com os adaptadores locais e aplica o catálogo sintético. */
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { carregarNucleo } = require('./nucleo');
const { criarArmazenamentoJsonl, criarLockArquivo } = require('./armazenamento-jsonl');

const CAMINHO_CATALOGO = path.join(__dirname, '..', 'fixtures', 'catalogo-seed.json');

function criarPulsoLocal(diretorio) {
  const armazenamento = criarArmazenamentoJsonl(diretorio);
  return carregarNucleo().criar({
    armazenamento,
    lock: criarLockArquivo(path.join(diretorio, '.pulso.lock')),
    relogio: () => new Date().toISOString(),
    gerarId: (prefixo) => `${prefixo}-${crypto.randomUUID()}`,
  });
}

/** Reaplicar é seguro: cada produto usa uma requisição fixa e idempotente. */
function aplicarCatalogo(pulso, caminho = CAMINHO_CATALOGO) {
  const { produtos } = JSON.parse(fs.readFileSync(caminho, 'utf8'));
  return produtos.map((produto) => pulso.cadastrarProduto({ requisicaoId: `SEED-CADASTRO-${produto.sku}`, ...produto }));
}

module.exports = { criarPulsoLocal, aplicarCatalogo, CAMINHO_CATALOGO };
