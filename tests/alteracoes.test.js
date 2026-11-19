'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { ambienteComProduto } = require('./apoio');
const PEDIDO = { requisicaoId: 'ALT-1', sku: 'MER-001', campos: { precoVendaCentavos: 1200 }, motivo: 'Revisão fictícia' };

test('alteração deriva estado vigente e preserva criação e todas as versões', () => {
  const { pulso, armazenamento } = ambienteComProduto();
  const original = { ...armazenamento.tabelas.PRODUTOS[0] };
  const campos = { nome: 'Novo Produto Fictício', categoria: 'BEBIDAS', precoVendaCentavos: 1200,
    custoRefCentavos: 700, estoqueMinimo: 7, estoqueAlvo: 20, fornecedorId: 'FOR-001' };
  assert.equal(pulso.alterarProduto({ ...PEDIDO, campos }).ok, true);
  assert.deepEqual(armazenamento.tabelas.PRODUTOS[0], original);
  const consulta = pulso.consultarEstoque({ sku: 'MER-001' });
  assert.equal(consulta.nome, campos.nome);
  assert.equal(consulta.categoria, campos.categoria);
  assert.equal(consulta.precoVendaCentavos, 1200);
  assert.equal(consulta.custoRefCentavos, 700);
  assert.equal(consulta.estoqueMinimo, 7);
  assert.equal(consulta.estoqueAlvo, 20);
  assert.notEqual(consulta.atualizadoEm, original.atualizado_em);
  const versoes = pulso.consultarHistoricoProduto({ sku: 'MER-001' }).versoes;
  assert.equal(versoes.length, 2);
  assert.equal(versoes[0].produto.preco_venda_centavos, 990);
  assert.equal(versoes[1].produto.preco_venda_centavos, 1200);
});

test('campos_json guarda somente mudanças reais, em ordem canônica', () => {
  const { pulso, armazenamento } = ambienteComProduto();
  const pedido = { ...PEDIDO, campos: { estoqueAlvo: 12, nome: 'Nome Alterado', precoVendaCentavos: 1200 } };
  assert.equal(pulso.alterarProduto(pedido).ok, true);
  assert.equal(armazenamento.tabelas.PRODUTOS_ALTERACOES[0].campos_json, '{"nome":"Nome Alterado","precoVendaCentavos":1200}');
  assert.equal(pulso.alterarProduto({ ...pedido, campos: { precoVendaCentavos: 1200, nome: 'Nome Alterado', estoqueAlvo: 12 } }).duplicada, true);
  assert.equal(pulso.alterarProduto({ ...pedido, campos: { nome: 'Outro Nome' } }).erro.codigo, 'REQUISICAO_CONFLITANTE');
});

for (const campos of [{ sku: 'MER-002' }, { unidade: 'KG' }, { precoVendaCentavos: -1 }, { custoRefCentavos: '700' },
  { nome: '=1+1' }, { categoria: 'DESCONHECIDA' }, { estoqueMinimo: 15 }, { estoqueAlvo: 4 }, { ativo: 'sim' }, {}]) {
  test(`alteração rejeita estado inválido ou campo imutável ${JSON.stringify(campos)}`, () => {
    const { pulso, armazenamento } = ambienteComProduto();
    assert.equal(pulso.alterarProduto({ ...PEDIDO, campos }).erro.codigo, 'DADOS_INVALIDOS');
    assert.equal(armazenamento.tabelas.PRODUTOS_ALTERACOES.length, 0);
  });
}

test('alteração exige motivo, mudança efetiva e fornecedor existente', () => {
  const { pulso } = ambienteComProduto();
  assert.equal(pulso.alterarProduto({ ...PEDIDO, motivo: undefined }).erro.codigo, 'DADOS_INVALIDOS');
  assert.equal(pulso.alterarProduto({ ...PEDIDO, campos: { precoVendaCentavos: 990 } }).erro.codigo, 'ALTERACAO_SEM_MUDANCA');
  assert.equal(pulso.alterarProduto({ ...PEDIDO, campos: { fornecedorId: 'FOR-999' } }).erro.codigo, 'FORNECEDOR_INEXISTENTE');
});

test('desativação impede entrada, mantém histórico, aceita repetição e permite reativar', () => {
  const { pulso } = ambienteComProduto();
  const pedido = { requisicaoId: 'STATUS-1', sku: 'MER-001', motivo: 'Pausa fictícia' };
  assert.equal(pulso.desativarProduto(pedido).ok, true);
  assert.equal(pulso.desativarProduto(pedido).duplicada, true);
  assert.equal(pulso.reativarProduto(pedido).erro.codigo, 'REQUISICAO_CONFLITANTE');
  assert.equal(pulso.registrarEntrada({ requisicaoId: 'ENT-ALT', sku: 'MER-001', quantidade: 1, custoUnitCentavos: 600, fornecedorId: 'FOR-001' }).erro.codigo, 'SKU_INATIVO');
  assert.equal(pulso.consultarHistoricoProduto({ sku: 'MER-001' }).versoes.length, 2);
  assert.equal(pulso.reativarProduto({ ...pedido, requisicaoId: 'STATUS-2' }).ok, true);
  assert.equal(pulso.consultarEstoque({ sku: 'MER-001' }).ativo, true);
  assert.equal(pulso.consultarHistoricoProduto({ sku: 'MER-001' }).versoes.length, 3);
});

for (const etapa of ['PENDENTE', 'DADO', 'CONFIRMADA']) for (const modo of ['antes', 'depois', 'silencioso']) {
  test(`alteração falha ${etapa}/${modo}, repetição confirma exatamente uma vez`, () => {
    const { pulso, armazenamento } = ambienteComProduto();
    armazenamento.falharNaProxima(etapa === 'DADO' ? 'PRODUTOS_ALTERACOES' : 'OPERACOES_LOG', modo,
      etapa === 'DADO' ? undefined : (e) => e.estado === etapa);
    assert.equal(pulso.alterarProduto(PEDIDO).ok, false);
    assert.equal(pulso.alterarProduto(PEDIDO).ok, true);
    assert.equal(pulso.alterarProduto(PEDIDO).duplicada, true);
    assert.equal(armazenamento.tabelas.PRODUTOS_ALTERACOES.length, 1);
    assert.equal(pulso.consultarEstoque({ sku: 'MER-001' }).precoVendaCentavos, 1200);
  });
}

test('adulteração de alteração é detectada', () => {
  const { pulso, armazenamento } = ambienteComProduto();
  pulso.alterarProduto(PEDIDO);
  armazenamento.tabelas.PRODUTOS_ALTERACOES[0].campos_json = '{"precoVendaCentavos":1}';
  assert.equal(pulso.listarProdutos().erro.codigo, 'DADOS_INCONSISTENTES');
});
