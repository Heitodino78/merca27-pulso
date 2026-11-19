'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { criarAmbiente, ambienteComProduto, PRODUTO_BASE } = require('./apoio');
const FORNECEDOR = { requisicaoId: 'FOR-TESTE-2', fornecedorId: 'FOR-002', nomeFicticio: 'Distribuidora Fictícia', categoriaPrincipal: 'MERCEARIA', prazoEstimadoDias: 3 };
const ENTRADA = { requisicaoId: 'CUSTO-1', sku: 'MER-001', quantidade: 10, custoUnitCentavos: 500, fornecedorId: 'FOR-001' };

test('fornecedor tem cadastro idempotente, conflito explícito e ID único', () => {
  const { pulso, armazenamento } = criarAmbiente();
  assert.equal(pulso.cadastrarFornecedor(FORNECEDOR).ok, true);
  assert.equal(pulso.cadastrarFornecedor(FORNECEDOR).duplicada, true);
  assert.equal(pulso.cadastrarFornecedor({ ...FORNECEDOR, prazoEstimadoDias: 7 }).erro.codigo, 'REQUISICAO_CONFLITANTE');
  assert.equal(pulso.cadastrarFornecedor({ ...FORNECEDOR, requisicaoId: 'OUTRA-FOR' }).erro.codigo, 'FORNECEDOR_DUPLICADO');
  assert.equal(armazenamento.tabelas.FORNECEDORES.length, 2);
  assert.equal(pulso.listarFornecedores().fornecedores.length, 2);
});

for (const alteracao of [{ fornecedorId: 'x' }, { nomeFicticio: '=1+1' }, { categoriaPrincipal: 'X' }, { prazoEstimadoDias: -1 }, { prazoEstimadoDias: 1.5 }, { ativo: 'sim' }, { telefone: 'não permitido' }]) {
  test(`fornecedor rejeita dados inválidos ${JSON.stringify(alteracao)}`, () => {
    const { pulso, armazenamento } = criarAmbiente();
    assert.equal(pulso.cadastrarFornecedor({ ...FORNECEDOR, ...alteracao }).erro.codigo, 'DADOS_INVALIDOS');
    assert.equal(armazenamento.tabelas.FORNECEDORES.length, 1);
  });
}

test('produto valida fornecedor informado, entrada exige fornecedor existente e ativo', () => {
  const { pulso } = criarAmbiente();
  assert.equal(pulso.cadastrarProduto({ ...PRODUTO_BASE, fornecedorId: 'FOR-999' }).erro.codigo, 'FORNECEDOR_INEXISTENTE');
  assert.equal(pulso.cadastrarProduto(PRODUTO_BASE).ok, true);
  assert.equal(pulso.registrarEntrada({ ...ENTRADA, fornecedorId: 'FOR-999' }).erro.codigo, 'FORNECEDOR_INEXISTENTE');
  assert.equal(pulso.cadastrarFornecedor({ ...FORNECEDOR, ativo: false }).ok, true);
  assert.equal(pulso.registrarEntrada({ ...ENTRADA, fornecedorId: 'FOR-002' }).erro.codigo, 'FORNECEDOR_INATIVO');
  assert.equal(pulso.registrarEntrada({ ...ENTRADA, fornecedorId: undefined }).erro.codigo, 'DADOS_INVALIDOS');
});

for (const custoUnitCentavos of [undefined, null, -1, 1.5, NaN, Infinity, '500', true]) {
  test(`entrada rejeita custo inválido ${String(custoUnitCentavos)}`, () => {
    const { pulso, armazenamento } = ambienteComProduto();
    assert.equal(pulso.registrarEntrada({ ...ENTRADA, custoUnitCentavos }).erro.codigo, 'DADOS_INVALIDOS');
    assert.equal(armazenamento.tabelas.MOVIMENTOS_ESTOQUE.length, 0);
  });
}

test('custo zero é bonificação, fica no histórico e não altera custo de referência', () => {
  const { pulso, armazenamento } = ambienteComProduto();
  assert.equal(pulso.registrarEntrada({ ...ENTRADA, custoUnitCentavos: 0 }).ok, true);
  assert.equal(pulso.registrarEntrada({ ...ENTRADA, custoUnitCentavos: 1 }).erro.codigo, 'REQUISICAO_CONFLITANTE');
  const historico = pulso.consultarEstoque({ sku: 'MER-001' }).historico;
  assert.equal(historico[0].custoUnitCentavos, 0);
  assert.equal(historico[0].fornecedorId, 'FOR-001');
  assert.equal(armazenamento.tabelas.PRODUTOS[0].custo_ref_centavos, 600);
});

for (const etapa of ['PENDENTE', 'DADO', 'CONFIRMADA']) for (const modo of ['antes', 'depois', 'silencioso']) {
  test(`falha em fornecedor ${etapa}/${modo}: repetição conclui uma vez`, () => {
    const { pulso, armazenamento } = criarAmbiente();
    armazenamento.falharNaProxima(etapa === 'DADO' ? 'FORNECEDORES' : 'OPERACOES_LOG', modo,
      etapa === 'DADO' ? undefined : (e) => e.estado === etapa);
    assert.equal(pulso.cadastrarFornecedor(FORNECEDOR).ok, false);
    assert.equal(pulso.cadastrarFornecedor(FORNECEDOR).ok, true);
    assert.equal(armazenamento.tabelas.FORNECEDORES.filter((f) => f.fornecedor_id === 'FOR-002').length, 1);
    assert.equal(pulso.cadastrarFornecedor(FORNECEDOR).duplicada, true);
  });
}

test('adulteração de fornecedor é detectada na leitura', () => {
  const { pulso, armazenamento } = criarAmbiente();
  armazenamento.tabelas.FORNECEDORES[0].prazo_estimado_dias = 500;
  assert.equal(pulso.listarFornecedores().erro.codigo, 'DADOS_INCONSISTENTES');
});
