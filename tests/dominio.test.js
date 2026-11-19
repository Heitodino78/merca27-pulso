'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { ambienteComProduto, criarAmbiente, PRODUTO_BASE } = require('./apoio');

const QUANTIDADES_INVALIDAS = [
  ['zero', 0], ['negativa', -1], ['decimal', 1.5], ['NaN', NaN], ['infinita', Infinity],
  ['texto numérico', '10'], ['texto com vírgula', '2,5'], ['nula', null], ['ausente', undefined],
  ['booleana', true], ['lista', [1]], ['objeto', {}], ['acima do inteiro seguro', 2 ** 53],
];

for (const [nome, quantidade] of QUANTIDADES_INVALIDAS) {
  test(`entrada rejeita quantidade ${nome}`, () => {
    const { pulso, armazenamento } = ambienteComProduto();
    const r = pulso.registrarEntrada({ requisicaoId: 'REQ-Q', sku: 'MER-001', quantidade });
    assert.equal(r.erro.codigo, 'QTD_INVALIDA');
    assert.equal(armazenamento.tabelas.MOVIMENTOS_ESTOQUE.length, 0);
  });
}

for (const sku of ['', 'mer-001', 'MER-1', 'MER-001 ', 'XYZ-001', null, undefined, 1, {}]) {
  test(`entrada rejeita SKU malformado: ${JSON.stringify(sku)}`, () => {
    const { pulso } = ambienteComProduto();
    assert.equal(pulso.registrarEntrada({ requisicaoId: 'REQ-S', sku, quantidade: 1 }).erro.codigo, 'SKU_INVALIDO');
  });
}

for (const requisicaoId of ['', ' ', 'com espaço', null, undefined, 7, {}, 'x'.repeat(81)]) {
  test(`entrada rejeita requisição inválida: ${JSON.stringify(requisicaoId)}`, () => {
    const { pulso } = ambienteComProduto();
    assert.equal(pulso.registrarEntrada({ requisicaoId, sku: 'MER-001', quantidade: 1 }).erro.codigo, 'REQUISICAO_INVALIDA');
  });
}

for (const request of [undefined, null, 'texto', 5, []]) {
  test(`entrada rejeita pedido que não é objeto: ${JSON.stringify(request)}`, () => {
    const { pulso } = ambienteComProduto();
    assert.equal(pulso.registrarEntrada(request).erro.codigo, 'REQUISICAO_INVALIDA');
  });
}

test('requisição chamada __proto__ é tratada como identificador comum', () => {
  const { pulso } = ambienteComProduto();
  assert.equal(pulso.registrarEntrada({ requisicaoId: '__proto__', sku: 'MER-001', quantidade: 2 }).erro.codigo, 'REQUISICAO_INVALIDA');
  assert.equal(pulso.registrarEntrada({ requisicaoId: 'a__proto__', sku: 'MER-001', quantidade: 2 }).saldoAtual, 2);
});

const CADASTROS_INVALIDOS = [
  ['nome curto', { nome: 'ab' }],
  ['nome longo', { nome: 'x'.repeat(121) }],
  ['nome com fórmula', { nome: '=IMPORTXML("x")' }],
  ['nome com espaço nas pontas', { nome: ' Produto ' }],
  ['nome com quebra de linha', { nome: 'Produto\nTeste' }],
  ['categoria desconhecida', { categoria: 'ELETRONICOS' }],
  ['unidade fracionada', { unidade: 'KG' }],
  ['preço negativo', { precoVendaCentavos: -1 }],
  ['preço decimal', { precoVendaCentavos: 9.9 }],
  ['preço em texto', { precoVendaCentavos: '990' }],
  ['custo NaN', { custoRefCentavos: NaN }],
  ['mínimo negativo', { estoqueMinimo: -1 }],
  ['alvo menor que mínimo', { estoqueMinimo: 10, estoqueAlvo: 9 }],
  ['ativo em texto', { ativo: 'sim' }],
  ['fornecedor malformado', { fornecedorId: 'ACME' }],
  ['tentativa de definir saldo', { saldo: 50 }],
];

for (const [nome, alteracao] of CADASTROS_INVALIDOS) {
  test(`cadastro rejeita ${nome}`, () => {
    const { pulso, armazenamento } = criarAmbiente();
    const r = pulso.cadastrarProduto({ ...PRODUTO_BASE, ...alteracao });
    assert.equal(r.erro.codigo, 'DADOS_INVALIDOS');
    assert.equal(armazenamento.tabelas.PRODUTOS.length, 0);
  });
}

test('entrada rejeita tentativa de informar saldo e texto com fórmula', () => {
  const { pulso } = ambienteComProduto();
  assert.equal(pulso.registrarEntrada({ requisicaoId: 'R1', sku: 'MER-001', quantidade: 1, saldo: 99 }).erro.codigo, 'DADOS_INVALIDOS');
  assert.equal(pulso.registrarEntrada({ requisicaoId: 'R2', sku: 'MER-001', quantidade: 1, motivo: '=1+1' }).erro.codigo, 'DADOS_INVALIDOS');
  assert.equal(pulso.registrarEntrada({ requisicaoId: 'R3', sku: 'MER-001', quantidade: 1, referenciaFornecedor: '@x' }).erro.codigo, 'DADOS_INVALIDOS');
  assert.equal(pulso.registrarEntrada({ requisicaoId: 'R4', sku: 'MER-001', quantidade: 1, operadorSimulado: 'nome real' }).erro.codigo, 'DADOS_INVALIDOS');
});

test('valores-limite válidos são aceitos', () => {
  const { pulso } = criarAmbiente();
  const r = pulso.cadastrarProduto({ ...PRODUTO_BASE, nome: 'abc', precoVendaCentavos: 0, custoRefCentavos: 0, estoqueMinimo: 0, estoqueAlvo: 0 });
  assert.equal(r.ok, true);
  assert.equal(pulso.registrarEntrada({ requisicaoId: 'REQ-L', sku: 'MER-001', quantidade: 1 }).saldoAtual, 1);
});
