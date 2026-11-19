'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { criarAmbiente, ambienteComProduto, PRODUTO_BASE, eventos, saldoRecalculado } = require('./apoio');

const ENTRADA = Object.freeze({ custoUnitCentavos: 600, fornecedorId: 'FOR-001', requisicaoId: 'REQ-ENT-001', sku: 'MER-001', quantidade: 10 });
const saldo = (pulso, sku = 'MER-001') => pulso.consultarEstoque({ sku }).saldoAtual;

test('cenário obrigatório: os sete testes em sequência sobre o mesmo estoque', async (t) => {
  const { pulso, armazenamento } = ambienteComProduto();
  const movimentos = () => armazenamento.tabelas.MOVIMENTOS_ESTOQUE.length;

  await t.test('estado inicial: saldo 0', () => assert.equal(saldo(pulso), 0));

  await t.test('1. entrada válida de 10: saldo 10 e exatamente um movimento', () => {
    const r = pulso.registrarEntrada({ custoUnitCentavos: 600, fornecedorId: 'FOR-001', ...ENTRADA });
    assert.equal(r.ok, true);
    assert.equal(r.saldoAtual, 10);
    assert.equal(saldo(pulso), 10);
    assert.equal(movimentos(), 1);
  });

  await t.test('2. mesma requisição: saldo 10, sem novo movimento', () => {
    const r = pulso.registrarEntrada({ custoUnitCentavos: 600, fornecedorId: 'FOR-001', ...ENTRADA });
    assert.equal(r.ok, true);
    assert.equal(r.duplicada, true);
    assert.equal(r.aviso, 'OPERACAO_DUPLICADA');
    assert.equal(saldo(pulso), 10);
    assert.equal(movimentos(), 1);
  });

  await t.test('3. quantidade -5: rejeitada, saldo 10', () => {
    const r = pulso.registrarEntrada({ custoUnitCentavos: 600, fornecedorId: 'FOR-001', requisicaoId: 'REQ-ENT-002', sku: 'MER-001', quantidade: -5 });
    assert.equal(r.erro.codigo, 'QTD_INVALIDA');
    assert.equal(saldo(pulso), 10);
    assert.equal(movimentos(), 1);
  });

  await t.test('4. SKU inexistente: rejeitada, histórico intacto', () => {
    const r = pulso.registrarEntrada({ custoUnitCentavos: 600, fornecedorId: 'FOR-001', requisicaoId: 'REQ-ENT-003', sku: 'MER-999', quantidade: 1 });
    assert.equal(r.erro.codigo, 'SKU_INEXISTENTE');
    assert.equal(movimentos(), 1);
  });

  await t.test('5. quantidade 2,5: rejeitada', () => {
    const r = pulso.registrarEntrada({ custoUnitCentavos: 600, fornecedorId: 'FOR-001', requisicaoId: 'REQ-ENT-004', sku: 'MER-001', quantidade: 2.5 });
    assert.equal(r.erro.codigo, 'QTD_INVALIDA');
    assert.equal(saldo(pulso), 10);
  });

  await t.test('6. consistência: recálculo independente igual à consulta', () => {
    pulso.registrarEntrada({ custoUnitCentavos: 600, fornecedorId: 'FOR-001', requisicaoId: 'REQ-ENT-005', sku: 'MER-001', quantidade: 7 });
    assert.equal(saldo(pulso), 17);
    assert.equal(saldoRecalculado(armazenamento, 'MER-001'), saldo(pulso));
  });

  await t.test('7. falha de armazenamento: sem sucesso falso e sem alterar o saldo', () => {
    armazenamento.falharNaProxima('MOVIMENTOS_ESTOQUE', 'antes');
    const r = pulso.registrarEntrada({ custoUnitCentavos: 600, fornecedorId: 'FOR-001', requisicaoId: 'REQ-ENT-006', sku: 'MER-001', quantidade: 3 });
    assert.equal(r.ok, false);
    assert.equal(r.erro.codigo, 'FALHA_GRAVACAO');
    assert.equal(saldo(pulso), 17);
    assert.equal(eventos(armazenamento, 'CONFIRMADA').some((e) => e.requisicao_id === 'REQ-ENT-006'), false);
  });
});

test('requisição repetida com dados diferentes é rejeitada explicitamente', () => {
  const { pulso, armazenamento } = ambienteComProduto();
  pulso.registrarEntrada({ custoUnitCentavos: 600, fornecedorId: 'FOR-001', ...ENTRADA });
  const r = pulso.registrarEntrada({ custoUnitCentavos: 600, fornecedorId: 'FOR-001', ...ENTRADA, quantidade: 11 });
  assert.equal(r.erro.codigo, 'REQUISICAO_CONFLITANTE');
  assert.equal(saldo(pulso), 10);
  assert.equal(armazenamento.tabelas.MOVIMENTOS_ESTOQUE.length, 1);
});

test('requisição de um tipo não pode ser reaproveitada em outro tipo', () => {
  const { pulso } = ambienteComProduto();
  const r = pulso.registrarEntrada({ custoUnitCentavos: 600, fornecedorId: 'FOR-001', requisicaoId: PRODUTO_BASE.requisicaoId, sku: 'MER-001', quantidade: 1 });
  assert.equal(r.erro.codigo, 'REQUISICAO_CONFLITANTE');
  assert.equal(saldo(pulso), 0);
});

test('requisição rejeitada por validação pode ser corrigida e reenviada', () => {
  const { pulso } = ambienteComProduto();
  assert.equal(pulso.registrarEntrada({ custoUnitCentavos: 600, fornecedorId: 'FOR-001', requisicaoId: 'REQ-X', sku: 'MER-001', quantidade: 0 }).ok, false);
  assert.equal(pulso.registrarEntrada({ custoUnitCentavos: 600, fornecedorId: 'FOR-001', requisicaoId: 'REQ-X', sku: 'MER-001', quantidade: 4 }).saldoAtual, 4);
});

test('produto inativo não recebe entrada, mas continua consultável', () => {
  const { pulso } = criarAmbiente();
  pulso.cadastrarProduto({ ...PRODUTO_BASE, ativo: false });
  const r = pulso.registrarEntrada({ custoUnitCentavos: 600, fornecedorId: 'FOR-001', ...ENTRADA });
  assert.equal(r.erro.codigo, 'SKU_INATIVO');
  assert.equal(pulso.consultarEstoque({ sku: 'MER-001' }).ativo, false);
  assert.equal(saldo(pulso), 0);
});

test('cadastro: SKU repetido é rejeitado e repetição idempotente não duplica', () => {
  const { pulso, armazenamento } = ambienteComProduto();
  assert.equal(pulso.cadastrarProduto({ ...PRODUTO_BASE }).duplicada, true);
  assert.equal(pulso.cadastrarProduto({ ...PRODUTO_BASE, requisicaoId: 'REQ-CAD-002' }).erro.codigo, 'SKU_DUPLICADO');
  assert.equal(armazenamento.tabelas.PRODUTOS.length, 1);
});

test('consulta devolve os campos exigidos e histórico com saldo acumulado', () => {
  const { pulso } = ambienteComProduto();
  pulso.registrarEntrada({ custoUnitCentavos: 600, fornecedorId: 'FOR-001', ...ENTRADA, referenciaFornecedor: 'NF-TESTE-1' });
  pulso.registrarEntrada({ custoUnitCentavos: 600, fornecedorId: 'FOR-001', requisicaoId: 'REQ-ENT-009', sku: 'MER-001', quantidade: 5 });
  const c = pulso.consultarEstoque({ sku: 'MER-001' });
  assert.equal(c.nome, PRODUTO_BASE.nome);
  assert.equal(c.saldoAtual, 15);
  assert.equal(c.estoqueMinimo, 5);
  assert.equal(c.estoqueAlvo, 12);
  assert.deepEqual(Array.from(c.historico, (m) => m.saldoApos), [10, 15]);
  assert.equal(c.historico[0].referenciaId, 'NF-TESTE-1');
  assert.equal(pulso.consultarEstoque({ sku: 'MER-001', limiteHistorico: 1 }).historico.length, 1);
});

test('saldos de SKUs diferentes são independentes', () => {
  const { pulso } = ambienteComProduto();
  pulso.cadastrarProduto({ ...PRODUTO_BASE, requisicaoId: 'REQ-CAD-002', sku: 'MER-002' });
  pulso.registrarEntrada({ custoUnitCentavos: 600, fornecedorId: 'FOR-001', ...ENTRADA });
  const r = pulso.registrarEntrada({ custoUnitCentavos: 600, fornecedorId: 'FOR-001', requisicaoId: 'REQ-ENT-020', sku: 'MER-002', quantidade: 4 });
  assert.equal(r.saldoAtual, 4);
  assert.equal(saldo(pulso, 'MER-001'), 10);
  assert.equal(saldo(pulso, 'MER-002'), 4);
  assert.deepEqual(Array.from(pulso.listarProdutos().produtos, (p) => p.saldoAtual), [10, 4]);
});

test('consulta de SKU inexistente ou malformado devolve erro claro', () => {
  const { pulso } = ambienteComProduto();
  assert.equal(pulso.consultarEstoque({ sku: 'MER-404' }).erro.codigo, 'SKU_INEXISTENTE');
  assert.equal(pulso.consultarEstoque({ sku: 'abc' }).erro.codigo, 'SKU_INVALIDO');
  assert.equal(pulso.consultarEstoque().erro.codigo, 'SKU_INVALIDO');
});

test('rejeições ficam registradas no log sem criar movimento', () => {
  const { pulso, armazenamento } = ambienteComProduto();
  pulso.registrarEntrada({ custoUnitCentavos: 600, fornecedorId: 'FOR-001', requisicaoId: 'REQ-R1', sku: 'MER-001', quantidade: -5 });
  const rejeicoes = eventos(armazenamento, 'REJEITADA');
  assert.equal(rejeicoes.length, 1);
  assert.equal(rejeicoes[0].erro_cod, 'QTD_INVALIDA');
  assert.equal(armazenamento.tabelas.MOVIMENTOS_ESTOQUE.length, 0);
});

test('a interface pública não oferece edição direta de saldo nem exclusão', () => {
  const { pulso } = criarAmbiente();
  assert.deepEqual(Object.keys(pulso).sort(), [
    'cadastrarFornecedor', 'cadastrarProduto', 'consultarEstoque', 'listarFornecedores', 'listarProdutos', 'reconciliarPendencias', 'registrarEntrada',
  ]);
});
