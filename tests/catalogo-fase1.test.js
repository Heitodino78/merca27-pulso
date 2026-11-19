'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { gerarCatalogo } = require('../local/gerar-fixtures');
const { criarPulsoLocal, aplicarCatalogo } = require('../local/app');

test('os seis SKUs originais preservam nome, preço, custo, mínimo e alvo', () => {
  const esperados = [
    ['MER-001', 'Água Mineral Fictícia 500 ml', 200, 160, 4, 11],
    ['MER-002', 'Arroz Demonstração 1 kg', 754, 580, 5, 11],
    ['MER-003', 'Leite Demonstração 1 L', 565, 425, 7, 17],
    ['MER-004', 'Biscoito Salgado Fictício 100 g', 377, 292, 6, 12],
    ['MER-005', 'Sabonete Demonstração 90 g', 343, 245, 6, 19],
    ['MER-006', 'Detergente Fictício 500 ml', 378, 268, 6, 14],
  ];
  assert.deepEqual(gerarCatalogo().produtos.slice(0, 6).map((p) => [p.sku, p.nome, p.precoVendaCentavos, p.custoRefCentavos, p.estoqueMinimo, p.estoqueAlvo]), esperados);
  const catalogo = gerarCatalogo();
  assert.equal(catalogo.produtos.length, 40);
  assert.equal(catalogo.fornecedores.length, 6);
  assert.equal(new Set(catalogo.produtos.map((p) => p.categoria)).size, 6);
  assert.ok(catalogo.produtos.every((p) => catalogo.fornecedores.some((f) => f.fornecedorId === p.fornecedorId)));
});

test('CLI da Fase 01 executa fornecedores, inventário, perdas, ajuste e versões', (t) => {
  const pasta = fs.mkdtempSync(path.join(os.tmpdir(), 'pulso-cli-fase1-'));
  t.after(() => fs.rmSync(pasta, { recursive: true, force: true }));
  const executar = (...args) => {
    const r = spawnSync(process.execPath, [path.resolve(__dirname, '../local/cli.js'), ...args], { encoding: 'utf8', env: { ...process.env, PULSO_DADOS: pasta } });
    assert.equal(r.status, 0, r.stderr);
    return r.stdout;
  };
  executar('seed'); executar('seed');
  executar('cadastrar-fornecedor', '--fornecedor', 'FOR-007', '--nome', 'Fornecedor Fictício Novo', '--categoria', 'MERCEARIA', '--prazo', '2');
  assert.match(executar('fornecedores'), /FOR-007/);
  executar('cadastrar', '--sku', 'MER-041', '--nome', 'Produto Fictício Novo', '--categoria', 'MERCEARIA', '--preco', '990', '--custo', '600', '--minimo', '5', '--alvo', '12', '--fornecedor', 'FOR-007');
  executar('saldo-inicial', '--sku', 'MER-041', '--quantidade', '7', '--custo', '600', '--motivo', 'Inventário fictício');
  executar('perda', '--sku', 'MER-041', '--quantidade', '2', '--categoria-perda', 'AVARIA', '--motivo', 'Avaria fictícia');
  executar('ajuste', '--sku', 'MER-041', '--contada', '4', '--motivo', 'Contagem fictícia');
  assert.match(executar('saldo', '--sku', 'MER-041'), /Saldo atual: 4 UN/);
  assert.match(executar('reposicao'), /MER-041.*sugestão 8.*FOR-007/);
  executar('alterar-produto', '--sku', 'MER-041', '--preco', '1200', '--motivo', 'Revisão fictícia');
  executar('desativar', '--sku', 'MER-041', '--motivo', 'Pausa fictícia');
  assert.doesNotMatch(executar('reposicao'), /^MER-041/m);
  executar('reativar', '--sku', 'MER-041', '--motivo', 'Retorno fictício');
  executar('entrada', '--sku', 'MER-041', '--quantidade', '2', '--custo', '500', '--fornecedor', 'FOR-007', '--requisicao', 'CLI-NOVA');
  assert.match(executar('entrada', '--sku', 'MER-041', '--quantidade', '2', '--custo', '500', '--fornecedor', 'FOR-007', '--requisicao', 'CLI-NOVA'), /saldo atual 6/);
  assert.match(executar('saldo', '--sku', 'MER-041'), /custo unitário R\$/);
});

test('recálculo independente de todos os SKUs coincide com a consulta', (t) => {
  const pasta = fs.mkdtempSync(path.join(os.tmpdir(), 'pulso-recalculo-'));
  t.after(() => fs.rmSync(pasta, { recursive: true, force: true }));
  const pulso = criarPulsoLocal(pasta);
  aplicarCatalogo(pulso);
  for (const [indice, produto] of gerarCatalogo().produtos.entries()) {
    assert.equal(pulso.registrarSaldoInicial({ requisicaoId: `REC-${indice}`, sku: produto.sku, quantidade: indice + 3, custoUnitCentavos: produto.custoRefCentavos, motivo: 'Inventário fictício' }).ok, true);
    if (indice % 3 === 0) assert.equal(pulso.registrarPerda({ requisicaoId: `REC-PERDA-${indice}`, sku: produto.sku, quantidade: 1, categoriaPerda: 'QUEBRA', motivo: 'Quebra fictícia' }).ok, true);
  }
  const ler = (tabela) => fs.readFileSync(path.join(pasta, `${tabela}.jsonl`), 'utf8').trim().split('\n').map((linha) => JSON.parse(linha));
  const confirmadas = new Set(ler('OPERACOES_LOG').filter((e) => e.estado === 'CONFIRMADA').map((e) => e.operacao_id));
  const movimentos = ler('MOVIMENTOS_ESTOQUE').filter((m) => confirmadas.has(m.operacao_id));
  for (const p of pulso.listarProdutos().produtos) {
    const soma = movimentos.filter((m) => m.sku === p.sku).reduce((total, m) => total + m.delta_unidades, 0);
    assert.equal(p.saldoAtual, soma, p.sku);
  }
});
