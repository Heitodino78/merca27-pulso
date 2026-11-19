'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { criarAmbiente, PRODUTO_BASE } = require('./apoio');
for (const [saldo, alerta, sugestao] of [[0, true, 12], [3, true, 9], [5, true, 7], [6, false, 0], [12, false, 0]]) {
  test(`reposição em saldo ${saldo}: alerta ${alerta}, sugestão ${sugestao}`, () => {
    const { pulso, armazenamento } = criarAmbiente();
    pulso.cadastrarProduto({ ...PRODUTO_BASE, fornecedorId: 'FOR-001' });
    if (saldo) pulso.registrarSaldoInicial({ requisicaoId: 'REP-INICIAL', sku: 'MER-001', quantidade: saldo, custoUnitCentavos: 600, motivo: 'Inventário fictício' });
    const antes = JSON.stringify(armazenamento.tabelas);
    const r = pulso.consultarReposicao();
    assert.equal(r.ok, true);
    assert.equal(r.itens.length, alerta ? 1 : 0);
    if (alerta) {
      assert.equal(r.itens[0].sugestaoUnidades, sugestao);
      assert.equal(r.itens[0].saldoAtual, saldo);
      assert.equal(r.itens[0].fornecedor.fornecedor_id, 'FOR-001');
      assert.match(r.itens[0].regra, /saldo <= mínimo/);
    }
    assert.equal(JSON.stringify(armazenamento.tabelas), antes, 'Consulta não deve gravar nada.');
  });
}
test('entrada que alcança o alvo remove alerta e produto inativo não aparece', () => {
  const { pulso } = criarAmbiente();
  pulso.cadastrarProduto(PRODUTO_BASE);
  pulso.registrarSaldoInicial({ requisicaoId: 'REP-INICIAL', sku: 'MER-001', quantidade: 3, custoUnitCentavos: 600, motivo: 'Inventário fictício' });
  assert.equal(pulso.consultarReposicao().itens[0].sugestaoUnidades, 9);
  pulso.registrarEntrada({ requisicaoId: 'REP-ENTRADA', sku: 'MER-001', quantidade: 9, custoUnitCentavos: 600, fornecedorId: 'FOR-001' });
  assert.equal(pulso.consultarEstoque({ sku: 'MER-001' }).saldoAtual, 12);
  assert.equal(pulso.consultarReposicao().itens.length, 0);
  pulso.ajustarPorContagem({ requisicaoId: 'REP-CONTAGEM', sku: 'MER-001', quantidadeContada: 0, motivo: 'Contagem fictícia' });
  pulso.desativarProduto({ requisicaoId: 'REP-DESATIVAR', sku: 'MER-001', motivo: 'Pausa fictícia' });
  assert.equal(pulso.consultarReposicao().itens.length, 0);
});
