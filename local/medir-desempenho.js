'use strict';
/* Cenário fictício de 90 dias, sempre em pasta temporária. Não altera data/. */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { performance } = require('node:perf_hooks');
const { carregarNucleo } = require('./nucleo');
const { aplicarCatalogo } = require('./app');
const { gerarCatalogo } = require('./gerar-fixtures');
const { criarArmazenamentoJsonl, criarLockArquivo } = require('./armazenamento-jsonl');

function exigir(resultado) {
  if (!resultado.ok) throw new Error(JSON.stringify(resultado));
  return resultado;
}

function medirDesempenho(rotulo = 'atual') {
  const pasta = fs.mkdtempSync(path.join(os.tmpdir(), 'pulso-desempenho-'));
  try {
    const nucleo = carregarNucleo();
    const tabelas = Object.fromEntries(Object.keys(nucleo.esquema.TABELAS).map((nome) => [nome, []]));
    let sequencia = 0;
    let instante = Date.UTC(2026, 7, 21);
    const simulacao = nucleo.criar({
      armazenamento: { ler: (tabela) => tabelas[tabela].map((linha) => ({ ...linha })), anexar: (tabela, linha) => { tabelas[tabela].push({ ...linha }); } },
      lock: { executar: (fn) => fn() }, relogio: () => new Date(instante++).toISOString(), gerarId: (p) => `${p}-${++sequencia}`,
    });
    aplicarCatalogo(simulacao).forEach(exigir);
    const produtos = gerarCatalogo().produtos;
    for (let dia = 0; dia < 90; dia++) {
      instante = Date.UTC(2026, 7, 21 + dia);
      const p = produtos[dia % produtos.length];
      exigir(simulacao.registrarEntrada({ requisicaoId: `MED-ENT-${dia}`, sku: p.sku, quantidade: 6, custoUnitCentavos: p.custoRefCentavos, fornecedorId: p.fornecedorId }));
      exigir(simulacao.registrarPerda({ requisicaoId: `MED-PER-${dia}`, sku: p.sku, quantidade: 1, categoriaPerda: 'AVARIA', motivo: 'Avaria sintética' }));
      const saldo = exigir(simulacao.consultarEstoque({ sku: p.sku })).saldoAtual;
      exigir(simulacao.ajustarPorContagem({ requisicaoId: `MED-AJU-${dia}`, sku: p.sku, quantidadeContada: saldo + 1, motivo: 'Contagem sintética' }));
      if (dia % 7 === 0) exigir(simulacao.alterarProduto({ requisicaoId: `MED-ALT-${dia}`, sku: p.sku,
        campos: { precoVendaCentavos: p.precoVendaCentavos + dia + 1 }, motivo: 'Preço sintético' }));
    }
    for (const [nome, linhas] of Object.entries(tabelas)) {
      fs.writeFileSync(path.join(pasta, `${nome}.jsonl`), linhas.map((linha) => JSON.stringify(linha) + '\n').join(''));
    }
    const volume = Object.fromEntries(Object.entries(tabelas).map(([nome, linhas]) => [nome, linhas.length]));
    const base = criarArmazenamentoJsonl(pasta);
    let leituras = 0;
    let req = 0;
    const pulso = nucleo.criar({
      armazenamento: { ler: (tabela) => { leituras++; return base.ler(tabela); }, anexar: (tabela, linha) => base.anexar(tabela, linha) },
      lock: criarLockArquivo(path.join(pasta, '.pulso.lock')), relogio: () => new Date().toISOString(), gerarId: (p) => `${p}-MEDICAO-${++sequencia}`,
    });
    function medir(nome, funcao) {
      for (let i = 0; i < 3; i++) exigir(funcao());
      leituras = 0;
      const tempos = [];
      for (let i = 0; i < 20; i++) { const inicio = performance.now(); exigir(funcao()); tempos.push(performance.now() - inicio); }
      tempos.sort((a, b) => a - b);
      return { nome, repeticoes: tempos.length, medianaMs: +tempos[10].toFixed(3), mediaMs: +(tempos.reduce((a, b) => a + b, 0) / tempos.length).toFixed(3),
        p95Ms: +tempos[18].toFixed(3), leiturasPorChamada: leituras / tempos.length };
    }
    return { rotulo, node: process.version, dias: 90, operacoesDiarias: 3, alteracoesSemanais: 13, volume,
      medidas: [medir('listarProdutos', () => pulso.listarProdutos()), medir('consultarEstoque', () => pulso.consultarEstoque({ sku: 'MER-001' })),
        medir('consultarReposicao', () => pulso.consultarReposicao()), medir('registrarEntrada', () => pulso.registrarEntrada({ requisicaoId: `MED-BENCH-${++req}`,
          sku: 'MER-001', quantidade: 1, custoUnitCentavos: 160, fornecedorId: 'FOR-001' })),
        // M-03: cinco SKUs por contagem; a quantidade muda a cada chamada para sempre haver diferença.
        medir('registrarContagem', () => pulso.registrarContagem({ requisicaoId: `MED-CONT-${++req}`, motivo: 'Inventário fictício',
          itens: ['MER-010', 'MER-011', 'MER-012', 'MER-013', 'MER-014'].map((sku, i) => ({ sku, quantidadeContada: 100 + ((req + i) % 2) })) }))],
      limites: 'Ambiente local JSONL, dados sintéticos e volume declarado; não mede Google, vendas nem uma operação comercial real.' };
  } finally { fs.rmSync(pasta, { recursive: true, force: true }); }
}
if (require.main === module) console.log(JSON.stringify(medirDesempenho(process.argv[2] || 'atual'), null, 2));
module.exports = { medirDesempenho };
