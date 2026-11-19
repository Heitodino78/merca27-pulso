'use strict';
/* Fase 2: venda com vários itens, estorno total, consultas e integridade (docs/03 seções 6.2, 6.5, 8 e 12). */
const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { criarAmbiente, PRODUTO_BASE, eventos } = require('./apoio');
const { criarPulsoLocal, aplicarCatalogo } = require('../local/app');

const CLI = path.join(__dirname, '..', 'local', 'cli.js');
const BASE_FASE01 = path.join(__dirname, '..', 'fixtures', 'base-fase01');
const simples = (valor) => JSON.parse(JSON.stringify(valor));

/** MER-001 (preço 990, custo 600) com saldo 10; MER-002 (preço 500, custo 300) com saldo 5. */
function ambienteDeVenda() {
  const ambiente = criarAmbiente();
  const { pulso } = ambiente;
  const ok = (r) => { assert.equal(r.ok, true, JSON.stringify(r)); return r; };
  ok(pulso.cadastrarProduto({ ...PRODUTO_BASE, requisicaoId: 'V-CAD-1', sku: 'MER-001', precoVendaCentavos: 990, custoRefCentavos: 600 }));
  ok(pulso.cadastrarProduto({ ...PRODUTO_BASE, requisicaoId: 'V-CAD-2', sku: 'MER-002', nome: 'Produto Fictício Dois', precoVendaCentavos: 500, custoRefCentavos: 300 }));
  ok(pulso.registrarEntrada({ requisicaoId: 'V-ENT-1', sku: 'MER-001', quantidade: 10, custoUnitCentavos: 600, fornecedorId: 'FOR-001' }));
  ok(pulso.registrarEntrada({ requisicaoId: 'V-ENT-2', sku: 'MER-002', quantidade: 5, custoUnitCentavos: 300, fornecedorId: 'FOR-001' }));
  return ambiente;
}

const VENDA = Object.freeze({
  requisicaoId: 'V-VENDA-1', formaPagamentoFicticia: 'PIX',
  itens: [{ sku: 'MER-002', quantidade: 2 }, { sku: 'MER-001', quantidade: 3 }],
});
const saldo = (pulso, sku) => pulso.consultarEstoque({ sku }).saldoAtual;
const linhasDa = (armazenamento, tabela, operacao) => armazenamento.tabelas[tabela].filter((l) => l.operacao_id === operacao);
const intencao = (armazenamento, requisicao) => eventos(armazenamento, 'PENDENTE').find((e) => e.requisicao_id === requisicao);

// ---------------------------------------------------------------- venda

test('T05/T15: venda de vários itens baixa o estoque e captura preço, custo e totais em centavos', () => {
  const { pulso, armazenamento } = ambienteDeVenda();
  const r = pulso.confirmarVenda(VENDA);
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.match(r.vendaId, /^VEN-/);
  assert.equal(r.totalCentavos, 3 * 990 + 2 * 500);
  assert.equal(r.custoEstCentavos, 3 * 600 + 2 * 300);
  assert.deepEqual(simples(r.itens.map((i) => [i.sku, i.quantidade, i.precoUnitCentavos, i.subtotalCentavos, i.saldoAtual])),
    [['MER-001', 3, 990, 2970, 7], ['MER-002', 2, 500, 1000, 3]]);
  assert.equal(saldo(pulso, 'MER-001'), 7);
  assert.equal(saldo(pulso, 'MER-002'), 3);

  const operacao = intencao(armazenamento, VENDA.requisicaoId).operacao_id;
  const [venda] = linhasDa(armazenamento, 'VENDAS', operacao);
  const itens = linhasDa(armazenamento, 'ITENS_VENDA', operacao);
  const movimentos = linhasDa(armazenamento, 'MOVIMENTOS_ESTOQUE', operacao);
  assert.equal(venda.requisicao_id, VENDA.requisicaoId);
  assert.equal(venda.forma_pagamento, 'PIX');
  assert.equal(itens.reduce((s, i) => s + i.subtotal_centavos, 0), venda.total_centavos, 'Σ subtotais = total');
  assert.equal(itens.reduce((s, i) => s + i.quantidade * i.custo_unit_est_centavos, 0), venda.custo_est_centavos);
  assert.deepEqual(movimentos.map((m) => [m.tipo, m.sku, m.delta_unidades, m.referencia_id]),
    [['VENDA', 'MER-001', -3, venda.venda_id], ['VENDA', 'MER-002', -2, venda.venda_id]]);
  const payload = JSON.parse(intencao(armazenamento, VENDA.requisicaoId).payload);
  assert.deepEqual(payload.registros.map((x) => x.tabela), ['VENDAS', 'ITENS_VENDA', 'ITENS_VENDA', 'MOVIMENTOS_ESTOQUE', 'MOVIMENTOS_ESTOQUE']);
  assert.equal(intencao(armazenamento, VENDA.requisicaoId).referencia_id, venda.venda_id);
});

test('exemplo do Documento Mestre: venda de 4 com saldo 3 é rejeitada inteira', () => {
  const { pulso } = ambienteDeVenda();
  assert.equal(pulso.registrarPerda({ requisicaoId: 'V-PER', sku: 'MER-001', quantidade: 7, categoriaPerda: 'AVARIA', motivo: 'Avaria fictícia' }).ok, true);
  const r = pulso.confirmarVenda({ ...VENDA, itens: [{ sku: 'MER-001', quantidade: 4 }] });
  assert.equal(r.erro.codigo, 'SALDO_INSUFICIENTE');
  assert.match(r.erro.mensagem, /MER-001/);
  assert.equal(r.erro.detalhes.saldoDisponivel, 3);
  assert.equal(saldo(pulso, 'MER-001'), 3);
});

test('T06/T07: saldo insuficiente em um item recusa a venda inteira, sem gravar nada', () => {
  const { pulso, armazenamento } = ambienteDeVenda();
  const antes = JSON.stringify(armazenamento.tabelas);
  const r = pulso.confirmarVenda({ ...VENDA, itens: [{ sku: 'MER-001', quantidade: 3 }, { sku: 'MER-002', quantidade: 6 }] });
  assert.equal(r.erro.codigo, 'SALDO_INSUFICIENTE');
  assert.equal(r.erro.detalhes.sku, 'MER-002');
  assert.equal(saldo(pulso, 'MER-001'), 10);
  assert.equal(saldo(pulso, 'MER-002'), 5);
  const depois = simples(armazenamento.tabelas);
  delete depois.OPERACOES_LOG;
  const original = JSON.parse(antes);
  delete original.OPERACOES_LOG;
  assert.deepEqual(depois, original, 'só o log de rejeição muda');
});

test('venda igual ao saldo zera o estoque', () => {
  const { pulso } = ambienteDeVenda();
  assert.equal(pulso.confirmarVenda({ ...VENDA, itens: [{ sku: 'MER-002', quantidade: 5 }] }).ok, true);
  assert.equal(saldo(pulso, 'MER-002'), 0);
});

test('T08: a mesma requisição, mesmo com itens em outra ordem, baixa uma única vez; dados diferentes são conflito', () => {
  const { pulso, armazenamento } = ambienteDeVenda();
  const primeira = pulso.confirmarVenda(VENDA);
  const repetida = pulso.confirmarVenda({ ...VENDA, itens: [...VENDA.itens].reverse() });
  assert.equal(repetida.aviso, 'OPERACAO_DUPLICADA');
  assert.equal(repetida.vendaId, primeira.vendaId);
  assert.equal(pulso.confirmarVenda({ ...VENDA, formaPagamentoFicticia: 'DINHEIRO' }).erro.codigo, 'REQUISICAO_CONFLITANTE');
  assert.equal(armazenamento.tabelas.VENDAS.length, 1);
  assert.equal(saldo(pulso, 'MER-001'), 7);
});

const RECUSAS = [
  ['T09: SKU repetido (política: recusar)', { itens: [{ sku: 'MER-001', quantidade: 1 }, { sku: 'MER-001', quantidade: 2 }] }, 'DADOS_INVALIDOS'],
  ['T17: SKU ausente', { itens: [{ quantidade: 1 }] }, 'SKU_INVALIDO'],
  ['SKU inexistente', { itens: [{ sku: 'MER-001', quantidade: 1 }, { sku: 'MER-999', quantidade: 1 }] }, 'SKU_INEXISTENTE'],
  ['T03: quantidade zero', { itens: [{ sku: 'MER-001', quantidade: 0 }] }, 'QTD_INVALIDA'],
  ['T03: quantidade negativa', { itens: [{ sku: 'MER-001', quantidade: -1 }] }, 'QTD_INVALIDA'],
  ['T03: quantidade decimal', { itens: [{ sku: 'MER-001', quantidade: 1.5 }] }, 'QTD_INVALIDA'],
  ['T03: quantidade NaN', { itens: [{ sku: 'MER-001', quantidade: NaN }] }, 'QTD_INVALIDA'],
  ['quantidade em texto', { itens: [{ sku: 'MER-001', quantidade: '2' }] }, 'QTD_INVALIDA'],
  ['venda sem itens', { itens: [] }, 'DADOS_INVALIDOS'],
  ['mais de 50 itens', { itens: Array.from({ length: 51 }, (_, i) => ({ sku: `MER-${String(i + 1).padStart(3, '0')}`, quantidade: 1 })) }, 'DADOS_INVALIDOS'],
  ['forma de pagamento desconhecida', { formaPagamentoFicticia: 'BOLETO' }, 'DADOS_INVALIDOS'],
  ['forma de pagamento ausente', { formaPagamentoFicticia: undefined }, 'DADOS_INVALIDOS'],
  ['desconto não é aceito', { desconto: 100 }, 'DADOS_INVALIDOS'],
  ['preço enviado pelo cliente não é aceito', { itens: [{ sku: 'MER-001', quantidade: 1, precoUnitCentavos: 1 }] }, 'DADOS_INVALIDOS'],
  ['observação que parece fórmula', { observacao: '=HIPERLINK("x")' }, 'DADOS_INVALIDOS'],
];
for (const [nome, alteracao, codigo] of RECUSAS) {
  test(`venda recusada sem gravar: ${nome}`, () => {
    const { pulso, armazenamento } = ambienteDeVenda();
    const r = pulso.confirmarVenda({ ...VENDA, ...alteracao });
    assert.equal(r.ok, false);
    assert.equal(r.erro.codigo, codigo);
    assert.equal(armazenamento.tabelas.VENDAS.length, 0);
    assert.equal(armazenamento.tabelas.ITENS_VENDA.length, 0);
    assert.equal(saldo(pulso, 'MER-001'), 10);
  });
}

test('T10: produto inativo não vende, e a venda antiga continua no histórico', () => {
  const { pulso } = ambienteDeVenda();
  const venda = pulso.confirmarVenda(VENDA);
  assert.equal(pulso.desativarProduto({ requisicaoId: 'V-DES', sku: 'MER-001', motivo: 'Pausa fictícia' }).ok, true);
  const r = pulso.confirmarVenda({ ...VENDA, requisicaoId: 'V-VENDA-2' });
  assert.equal(r.erro.codigo, 'SKU_INATIVO');
  assert.equal(pulso.consultarVenda({ vendaId: venda.vendaId }).ok, true);
  assert.equal(pulso.consultarEstoque({ sku: 'MER-001' }).historico.filter((m) => m.tipo === 'VENDA').length, 1);
});

test('T11: alterar o preço depois não muda a venda histórica', () => {
  const { pulso } = ambienteDeVenda();
  const venda = pulso.confirmarVenda(VENDA);
  assert.equal(pulso.alterarProduto({ requisicaoId: 'V-ALT', sku: 'MER-001', motivo: 'Reajuste fictício', campos: { precoVendaCentavos: 1500, custoRefCentavos: 900 } }).ok, true);
  const consulta = pulso.consultarVenda({ vendaId: venda.vendaId });
  assert.equal(consulta.venda.totalCentavos, 3970);
  assert.equal(consulta.itens.find((i) => i.sku === 'MER-001').precoUnitCentavos, 990);
  const nova = pulso.confirmarVenda({ ...VENDA, requisicaoId: 'V-VENDA-NOVA', itens: [{ sku: 'MER-001', quantidade: 1 }] });
  assert.equal(nova.totalCentavos, 1500);
  assert.equal(nova.custoEstCentavos, 900);
});

test('T12: perda reduz o saldo e não aparece como venda', () => {
  const { pulso } = ambienteDeVenda();
  pulso.confirmarVenda(VENDA);
  pulso.registrarPerda({ requisicaoId: 'V-PER-2', sku: 'MER-001', quantidade: 2, categoriaPerda: 'QUEBRA', motivo: 'Quebra fictícia' });
  assert.equal(saldo(pulso, 'MER-001'), 5);
  assert.equal(pulso.listarVendas({}).vendas.length, 1);
});

// ---------------------------------------------------------------- estorno

test('estorno total devolve as unidades, grava uma vez e deixa a venda como ESTORNADA', () => {
  const { pulso, armazenamento } = ambienteDeVenda();
  const venda = pulso.confirmarVenda(VENDA);
  const ESTORNO = { requisicaoId: 'V-EST-1', vendaId: venda.vendaId, motivo: 'Devolução fictícia' };
  const r = pulso.estornarVenda(ESTORNO);
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.match(r.estornoId, /^EST-/);
  assert.equal(saldo(pulso, 'MER-001'), 10);
  assert.equal(saldo(pulso, 'MER-002'), 5);
  const consulta = pulso.consultarVenda({ vendaId: venda.vendaId });
  assert.equal(consulta.venda.estado, 'ESTORNADA');
  assert.equal(consulta.estorno.motivo, 'Devolução fictícia');
  assert.deepEqual(simples(consulta.movimentos.map((m) => [m.tipo, m.sku, m.deltaUnidades])),
    [['VENDA', 'MER-001', -3], ['VENDA', 'MER-002', -2], ['ESTORNO', 'MER-001', 3], ['ESTORNO', 'MER-002', 2]]);
  const estornos = armazenamento.tabelas.MOVIMENTOS_ESTOQUE.filter((m) => m.tipo === 'ESTORNO');
  assert.ok(estornos.every((m) => m.referencia_id === venda.vendaId && m.custo_unit_centavos === (m.sku === 'MER-001' ? 600 : 300)));
  assert.equal(armazenamento.tabelas.VENDAS.length, 1, 'a venda não é apagada nem editada');
  assert.equal(pulso.estornarVenda(ESTORNO).aviso, 'OPERACAO_DUPLICADA');
  assert.equal(pulso.estornarVenda({ ...ESTORNO, requisicaoId: 'V-EST-2' }).erro.codigo, 'VENDA_JA_ESTORNADA');
  assert.equal(pulso.estornarVenda({ ...ESTORNO, motivo: 'Outro motivo fictício' }).erro.codigo, 'REQUISICAO_CONFLITANTE');
  assert.equal(armazenamento.tabelas.ESTORNOS_VENDA.length, 1);
  assert.equal(saldo(pulso, 'MER-001'), 10);
});

test('estorno de venda inexistente ou com dados inválidos é recusado sem gravar', () => {
  const { pulso, armazenamento } = ambienteDeVenda();
  assert.equal(pulso.estornarVenda({ requisicaoId: 'V-EST-X', vendaId: 'VEN-NAO-EXISTE', motivo: 'Teste fictício' }).erro.codigo, 'VENDA_INEXISTENTE');
  for (const pedido of [{ vendaId: 'MER-001', motivo: 'Teste fictício' }, { vendaId: 'VEN-1', motivo: '' }, { vendaId: 'VEN-1', motivo: 'Teste fictício', extra: 1 }]) {
    assert.equal(pulso.estornarVenda({ requisicaoId: 'V-EST-Y', ...pedido }).erro.codigo, 'DADOS_INVALIDOS');
  }
  assert.equal(armazenamento.tabelas.ESTORNOS_VENDA.length, 0);
});

test('estorno é aceito mesmo com produto desativado depois da venda', () => {
  const { pulso } = ambienteDeVenda();
  const venda = pulso.confirmarVenda(VENDA);
  pulso.desativarProduto({ requisicaoId: 'V-DES-2', sku: 'MER-002', motivo: 'Pausa fictícia' });
  assert.equal(pulso.estornarVenda({ requisicaoId: 'V-EST-INATIVO', vendaId: venda.vendaId, motivo: 'Devolução fictícia' }).ok, true);
  assert.equal(saldo(pulso, 'MER-002'), 5);
});

test('estorno preserva custo capturado mesmo após reajuste do cadastro', () => {
  const { pulso, armazenamento } = ambienteDeVenda();
  const venda = pulso.confirmarVenda(VENDA);
  assert.equal(pulso.alterarProduto({ requisicaoId: 'V-ALT-CUSTO', sku: 'MER-001', motivo: 'Reajuste fictício', campos: { precoVendaCentavos: 1500, custoRefCentavos: 900 } }).ok, true);
  assert.equal(pulso.estornarVenda({ requisicaoId: 'V-EST-CUSTO', vendaId: venda.vendaId, motivo: 'Devolução fictícia' }).ok, true);
  assert.equal(armazenamento.tabelas.MOVIMENTOS_ESTOQUE.find((m) => m.tipo === 'ESTORNO' && m.sku === 'MER-001').custo_unit_centavos, 600);
  assert.equal(pulso.consultarVenda({ vendaId: venda.vendaId }).venda.custoEstCentavos, 2400);
});

test('estorno que excederia o limite de unidades é recusado antes da intenção, sem bloquear a base', () => {
  const { pulso, armazenamento } = ambienteDeVenda();
  const venda = pulso.confirmarVenda(VENDA);
  assert.equal(pulso.ajustarPorContagem({ requisicaoId: 'V-MAX', sku: 'MER-001', quantidadeContada: Number.MAX_SAFE_INTEGER, motivo: 'Limite sintético' }).ok, true);
  const r = pulso.estornarVenda({ requisicaoId: 'V-EST-MAX', vendaId: venda.vendaId, motivo: 'Devolução fictícia' });
  assert.equal(r.erro.codigo, 'QTD_INVALIDA');
  assert.match(r.erro.mensagem, /MER-001/);
  assert.equal(intencao(armazenamento, 'V-EST-MAX'), undefined);
  assert.equal(armazenamento.tabelas.ESTORNOS_VENDA.length, 0);
  assert.equal(pulso.listarVendas({}).vendas[0].estado, 'CONFIRMADA');
  assert.equal(saldo(pulso, 'MER-002'), 3);
});

for (const campo of ['precoVendaCentavos', 'custoRefCentavos']) {
  test(`venda recusa estouro de ${campo} antes de criar intenção`, () => {
    const { pulso, armazenamento } = ambienteDeVenda();
    assert.equal(pulso.alterarProduto({ requisicaoId: 'V-VALOR-MAX', sku: 'MER-001', campos: { [campo]: Number.MAX_SAFE_INTEGER }, motivo: 'Limite sintético' }).ok, true);
    const r = pulso.confirmarVenda(VENDA);
    assert.equal(r.erro.codigo, 'DADOS_INVALIDOS');
    assert.equal(intencao(armazenamento, VENDA.requisicaoId), undefined);
    assert.equal(armazenamento.tabelas.VENDAS.length, 0);
    assert.equal(saldo(pulso, 'MER-001'), 10);
  });
}

test('uma venda de 50 itens é aceita, com 101 registros na intenção', () => {
  const { pulso, armazenamento } = criarAmbiente();
  const itens = Array.from({ length: 50 }, (_, i) => ({ sku: `MER-${String(i + 1).padStart(3, '0')}`, quantidade: 1 }));
  for (const item of itens) {
    assert.equal(pulso.cadastrarProduto({ ...PRODUTO_BASE, sku: item.sku, requisicaoId: `L-CAD-${item.sku}` }).ok, true);
    assert.equal(pulso.registrarSaldoInicial({ requisicaoId: `L-SAL-${item.sku}`, sku: item.sku, quantidade: 1, custoUnitCentavos: 600, motivo: 'Inventário sintético' }).ok, true);
  }
  assert.equal(pulso.confirmarVenda({ ...VENDA, itens }).ok, true);
  assert.equal(JSON.parse(intencao(armazenamento, VENDA.requisicaoId).payload).registros.length, 101);
  assert.equal(pulso.consultarVenda({ requisicaoId: VENDA.requisicaoId }).itens.length, 50);
});

for (const consulta of [null, [], 'hoje', { desde: '2026-99-19T00:00:00.000Z' }, { desde: '2026-02-30T00:00:00.000Z' },
  { desde: '2026-11-20T00:00:00.000Z', ate: '2026-11-19T00:00:00.000Z' }]) {
  test(`período inválido é recusado: ${JSON.stringify(consulta)}`, () => {
    assert.equal(ambienteDeVenda().pulso.listarVendas(consulta).erro.codigo, 'DADOS_INVALIDOS');
  });
}

test('adulteração que desloca a desativação para antes da venda é detectada pela reprodução', () => {
  const { pulso, armazenamento } = ambienteDeVenda();
  assert.equal(pulso.confirmarVenda(VENDA).ok, true);
  assert.equal(pulso.desativarProduto({ requisicaoId: 'V-DES-FORJADA', sku: 'MER-001', motivo: 'Pausa sintética' }).ok, true);
  const log = armazenamento.tabelas.OPERACOES_LOG;
  const desativacao = log.filter((e) => e.requisicao_id === 'V-DES-FORJADA');
  armazenamento.tabelas.OPERACOES_LOG = log.filter((e) => e.requisicao_id !== 'V-DES-FORJADA');
  const pos = armazenamento.tabelas.OPERACOES_LOG.findIndex((e) => e.requisicao_id === VENDA.requisicaoId);
  armazenamento.tabelas.OPERACOES_LOG.splice(pos, 0, ...desativacao);
  const r = pulso.listarVendas({});
  assert.equal(r.erro.codigo, 'DADOS_INCONSISTENTES');
  assert.match(r.erro.mensagem, /venda de produto inativo/);
});

// ---------------------------------------------------------------- consultas

test('listarVendas: mais recentes primeiro, estado derivado e filtro por período', () => {
  const { pulso } = ambienteDeVenda();
  const v1 = pulso.confirmarVenda(VENDA);
  const v2 = pulso.confirmarVenda({ ...VENDA, requisicaoId: 'V-VENDA-2', itens: [{ sku: 'MER-001', quantidade: 1 }], formaPagamentoFicticia: 'CARTAO' });
  pulso.estornarVenda({ requisicaoId: 'V-EST-L', vendaId: v1.vendaId, motivo: 'Devolução fictícia' });
  const lista = pulso.listarVendas({});
  assert.deepEqual(simples(lista.vendas.map((v) => [v.vendaId, v.estado, v.quantidadeItens])), [[v2.vendaId, 'CONFIRMADA', 1], [v1.vendaId, 'ESTORNADA', 2]]);
  const instante = pulso.consultarVenda({ vendaId: v2.vendaId }).venda.registradoEm;
  assert.deepEqual(simples(pulso.listarVendas({ desde: instante }).vendas.map((v) => v.vendaId)), [v2.vendaId]);
  assert.deepEqual(simples(pulso.listarVendas({ ate: instante }).vendas.map((v) => v.vendaId)), [v1.vendaId]);
  assert.equal(pulso.listarVendas({ desde: 'ontem' }).erro.codigo, 'DADOS_INVALIDOS');
  assert.equal(pulso.listarVendas({ limite: 0 }).erro.codigo, 'DADOS_INVALIDOS');
  assert.equal(pulso.listarVendas({ limite: 1 }).vendas.length, 1);
});

test('consultarVenda por vendaId ou por requisicaoId, e erro claro quando não existe', () => {
  const { pulso } = ambienteDeVenda();
  const venda = pulso.confirmarVenda(VENDA);
  assert.equal(pulso.consultarVenda({ requisicaoId: VENDA.requisicaoId }).venda.vendaId, venda.vendaId);
  assert.equal(pulso.consultarVenda({ vendaId: 'VEN-X' }).erro.codigo, 'VENDA_INEXISTENTE');
  assert.equal(pulso.consultarVenda({}).erro.codigo, 'DADOS_INVALIDOS');
  assert.equal(pulso.consultarVenda({ vendaId: venda.vendaId, requisicaoId: 'X' }).erro.codigo, 'DADOS_INVALIDOS');
});

test('base sem as tabelas de venda é lida como zero vendas', (t) => {
  const pasta = fs.mkdtempSync(path.join(os.tmpdir(), 'pulso-sem-vendas-'));
  t.after(() => fs.rmSync(pasta, { recursive: true, force: true }));
  fs.cpSync(BASE_FASE01, pasta, { recursive: true });
  const pulso = criarPulsoLocal(pasta);
  assert.deepEqual(simples(pulso.listarVendas({}).vendas), []);
  assert.equal(pulso.reconciliarPendencias().ok, true);
  const venda = pulso.confirmarVenda({ requisicaoId: 'V-BASE', formaPagamentoFicticia: 'DINHEIRO', itens: [{ sku: 'MER-001', quantidade: 2 }] });
  assert.equal(venda.ok, true, JSON.stringify(venda));
  assert.equal(pulso.consultarEstoque({ sku: 'MER-001' }).saldoAtual, 5);
});

// ---------------------------------------------------------------- falhas parciais (T18)

const POSICOES_VENDA = [
  ['VENDAS', () => true],
  ['ITENS_VENDA', (l) => l.item_id.endsWith('-1')],
  ['ITENS_VENDA', (l) => l.item_id.endsWith('-2')],
  ['MOVIMENTOS_ESTOQUE', (l) => l.tipo === 'VENDA' && l.movimento_id.endsWith('-1')],
  ['MOVIMENTOS_ESTOQUE', (l) => l.tipo === 'VENDA' && l.movimento_id.endsWith('-2')],
];
POSICOES_VENDA.forEach(([tabela, filtro], posicao) => {
  for (const modo of ['antes', 'depois', 'silencioso']) {
    test(`T18: falha ${modo} no registro ${posicao + 1} de 5 da venda não confirma, e a repetição conclui sem duplicar`, () => {
      const { pulso, armazenamento } = ambienteDeVenda();
      armazenamento.falharNaProxima(tabela, modo, filtro);
      const r = pulso.confirmarVenda(VENDA);
      assert.equal(r.ok, false);
      assert.equal(r.erro.codigo, 'FALHA_GRAVACAO');
      assert.equal(saldo(pulso, 'MER-001'), 10, 'venda incompleta não baixa estoque');
      assert.deepEqual(simples(pulso.listarVendas({}).vendas), [], 'venda incompleta não aparece');
      assert.equal(pulso.consultarVenda({ requisicaoId: VENDA.requisicaoId }).erro.codigo, 'VENDA_INEXISTENTE');
      const repeticao = pulso.confirmarVenda(VENDA);
      assert.equal(repeticao.ok, true);
      assert.equal(repeticao.recuperada, true);
      assert.equal(armazenamento.tabelas.VENDAS.length, 1);
      assert.equal(armazenamento.tabelas.ITENS_VENDA.length, 2);
      assert.equal(armazenamento.tabelas.MOVIMENTOS_ESTOQUE.filter((m) => m.tipo === 'VENDA').length, 2);
      assert.equal(saldo(pulso, 'MER-001'), 7);
    });
  }
});

const POSICOES_ESTORNO = [
  ['ESTORNOS_VENDA', () => true],
  ['MOVIMENTOS_ESTOQUE', (l) => l.tipo === 'ESTORNO' && l.movimento_id.endsWith('-1')],
  ['MOVIMENTOS_ESTOQUE', (l) => l.tipo === 'ESTORNO' && l.movimento_id.endsWith('-2')],
];
POSICOES_ESTORNO.forEach(([tabela, filtro], posicao) => {
  for (const modo of ['antes', 'depois', 'silencioso']) {
    test(`T18: falha ${modo} no registro ${posicao + 1} de 3 do estorno não confirma, e a repetição conclui sem duplicar`, () => {
      const { pulso, armazenamento } = ambienteDeVenda();
      const venda = pulso.confirmarVenda(VENDA);
      const ESTORNO = { requisicaoId: 'V-EST-F', vendaId: venda.vendaId, motivo: 'Devolução fictícia' };
      armazenamento.falharNaProxima(tabela, modo, filtro);
      assert.equal(pulso.estornarVenda(ESTORNO).ok, false);
      assert.equal(saldo(pulso, 'MER-001'), 7);
      assert.equal(pulso.consultarVenda({ vendaId: venda.vendaId }).venda.estado, 'CONFIRMADA');
      assert.equal(pulso.estornarVenda(ESTORNO).recuperada, true);
      assert.equal(armazenamento.tabelas.ESTORNOS_VENDA.length, 1);
      assert.equal(armazenamento.tabelas.MOVIMENTOS_ESTOQUE.filter((m) => m.tipo === 'ESTORNO').length, 2);
      assert.equal(saldo(pulso, 'MER-001'), 10);
    });
  }
});

test('venda interrompida é concluída pela reconciliação automática antes de outra venda', () => {
  const { pulso, armazenamento } = ambienteDeVenda();
  armazenamento.falharNaProxima('MOVIMENTOS_ESTOQUE', 'antes', (l) => l.tipo === 'VENDA' && l.movimento_id.endsWith('-2'));
  assert.equal(pulso.confirmarVenda(VENDA).ok, false);
  const outra = pulso.confirmarVenda({ ...VENDA, requisicaoId: 'V-VENDA-OUTRA', itens: [{ sku: 'MER-002', quantidade: 3 }] });
  assert.equal(outra.ok, true, 'a primeira (2 de MER-002) foi concluída antes: sobram 3');
  assert.equal(saldo(pulso, 'MER-002'), 0);
  const nova = pulso.confirmarVenda({ ...VENDA, requisicaoId: 'V-VENDA-SEM-SALDO', itens: [{ sku: 'MER-002', quantidade: 1 }] });
  assert.equal(nova.erro.codigo, 'SALDO_INSUFICIENTE');
});

// ---------------------------------------------------------------- adulteração

function vendaConfirmada() {
  const ambiente = ambienteDeVenda();
  const venda = ambiente.pulso.confirmarVenda(VENDA);
  const evento = intencao(ambiente.armazenamento, VENDA.requisicaoId);
  return { ...ambiente, venda, evento, operacao: evento.operacao_id };
}
function editarRegistro(evento, indice, alterar) {
  const p = JSON.parse(evento.payload);
  alterar(p.registros[indice].linha, p);
  evento.payload = JSON.stringify(p);
}
const ADULTERACOES = [
  ['item removido', ({ armazenamento, operacao }) => {
    const t = armazenamento.tabelas.ITENS_VENDA;
    t.splice(t.findIndex((i) => i.item_id === `ITV-${operacao}-2`), 1);
  }],
  ['item extra da mesma venda', ({ armazenamento, operacao }) => {
    const item = armazenamento.tabelas.ITENS_VENDA.find((i) => i.item_id === `ITV-${operacao}-1`);
    armazenamento.tabelas.ITENS_VENDA.push({ ...item, item_id: `ITV-${operacao}-9` });
  }],
  ['item com quantidade alterada na tabela', ({ armazenamento, operacao }) => {
    armazenamento.tabelas.ITENS_VENDA.find((i) => i.item_id === `ITV-${operacao}-1`).quantidade = 1;
  }],
  ['total divergente na intenção e na tabela', ({ armazenamento, evento }) => {
    editarRegistro(evento, 0, (l) => { l.total_centavos += 1; });
    armazenamento.tabelas.VENDAS[0].total_centavos += 1;
  }],
  ['preço capturado divergente do cadastro vigente', ({ armazenamento, evento, operacao }) => {
    editarRegistro(evento, 1, (l) => { l.preco_unit_centavos = 1; l.subtotal_centavos = 3; });
    editarRegistro(evento, 0, (l) => { l.total_centavos = 3 + 1000; });
    Object.assign(armazenamento.tabelas.ITENS_VENDA.find((i) => i.item_id === `ITV-${operacao}-1`), { preco_unit_centavos: 1, subtotal_centavos: 3 });
    armazenamento.tabelas.VENDAS[0].total_centavos = 1003;
  }],
  ['movimento de venda removido', ({ armazenamento, operacao }) => {
    const t = armazenamento.tabelas.MOVIMENTOS_ESTOQUE;
    t.splice(t.findIndex((m) => m.movimento_id === `MOV-${operacao}-2`), 1);
  }],
  ['movimento de venda sem item correspondente', ({ armazenamento, evento, operacao }) => {
    const p = JSON.parse(evento.payload);
    const extra = { ...p.registros[3].linha, movimento_id: `MOV-${operacao}-3` };
    p.registros.push({ tabela: 'MOVIMENTOS_ESTOQUE', linha: extra });
    evento.payload = JSON.stringify(p);
    armazenamento.tabelas.MOVIMENTOS_ESTOQUE.push(extra);
  }],
  ['quantidade do movimento diferente do item', ({ armazenamento, evento, operacao }) => {
    editarRegistro(evento, 3, (l) => { l.delta_unidades = -1; });
    armazenamento.tabelas.MOVIMENTOS_ESTOQUE.find((m) => m.movimento_id === `MOV-${operacao}-1`).delta_unidades = -1;
  }],
  ['venda de produto inexistente forjada', ({ armazenamento, evento, operacao }) => {
    const a = JSON.parse(evento.assinatura);
    a.itens[0].sku = 'MER-888';
    evento.assinatura = JSON.stringify(a);
    editarRegistro(evento, 1, (l) => { l.sku = 'MER-888'; });
    editarRegistro(evento, 3, (l) => { l.sku = 'MER-888'; });
    armazenamento.tabelas.ITENS_VENDA.find((i) => i.item_id === `ITV-${operacao}-1`).sku = 'MER-888';
    armazenamento.tabelas.MOVIMENTOS_ESTOQUE.find((m) => m.movimento_id === `MOV-${operacao}-1`).sku = 'MER-888';
  }],
  ['requisição da venda trocada', ({ armazenamento }) => { armazenamento.tabelas.VENDAS[0].requisicao_id = 'OUTRA'; }],
  ['referência só da intenção divergente', ({ evento, operacao }) => { evento.referencia_id = `ITV-${operacao}-1`; }],
  ['venda no formato antigo de payload', ({ evento }) => {
    const p = JSON.parse(evento.payload);
    evento.payload = JSON.stringify(p.registros[0]);
  }],
];
for (const [nome, adulterar] of ADULTERACOES) {
  test(`venda adulterada detectada: ${nome}`, () => {
    const ambiente = vendaConfirmada();
    adulterar(ambiente);
    assert.equal(ambiente.pulso.listarVendas({}).erro.codigo, 'DADOS_INCONSISTENTES');
    assert.equal(ambiente.pulso.confirmarVenda({ ...VENDA, requisicaoId: 'V-DEPOIS' }).erro.codigo, 'DADOS_INCONSISTENTES');
  });
}

test('estorno duplicado forjado no log é detectado', () => {
  const ambiente = vendaConfirmada();
  const { pulso, armazenamento, venda } = ambiente;
  assert.equal(pulso.estornarVenda({ requisicaoId: 'V-EST-A', vendaId: venda.vendaId, motivo: 'Devolução fictícia' }).ok, true);
  const eventosEstorno = armazenamento.tabelas.OPERACOES_LOG.filter((e) => e.requisicao_id === 'V-EST-A');
  const operacao = eventosEstorno[0].operacao_id;
  const nova = 'OPR-FORJADA';
  // Falsificação coerente: outro identificador de operação e outra requisição em tudo.
  const trocar = (texto) => texto.split(operacao).join(nova).split('V-EST-A').join('V-EST-B');
  for (const e of eventosEstorno) {
    armazenamento.tabelas.OPERACOES_LOG.push({ ...e, evento_id: `${e.evento_id}-F`, operacao_id: nova, requisicao_id: 'V-EST-B',
      referencia_id: e.referencia_id && trocar(e.referencia_id), payload: e.payload && trocar(e.payload) });
  }
  for (const tabela of ['ESTORNOS_VENDA', 'MOVIMENTOS_ESTOQUE']) {
    for (const l of armazenamento.tabelas[tabela].filter((x) => x.operacao_id === operacao)) {
      armazenamento.tabelas[tabela].push(JSON.parse(trocar(JSON.stringify(l))));
    }
  }
  const lista = pulso.listarVendas({});
  assert.equal(lista.erro.codigo, 'DADOS_INCONSISTENTES');
  assert.match(lista.erro.mensagem, /estorn/);
});

test('venda estornada com movimento de estorno faltando é detectada', () => {
  const ambiente = vendaConfirmada();
  const { pulso, armazenamento, venda } = ambiente;
  pulso.estornarVenda({ requisicaoId: 'V-EST-C', vendaId: venda.vendaId, motivo: 'Devolução fictícia' });
  const t = armazenamento.tabelas.MOVIMENTOS_ESTOQUE;
  t.splice(t.findIndex((m) => m.tipo === 'ESTORNO'), 1);
  assert.equal(pulso.listarVendas({}).erro.codigo, 'DADOS_INCONSISTENTES');
});

test('estorno forjado com quantidade diferente da venda é detectado', () => {
  const ambiente = vendaConfirmada();
  const { pulso, armazenamento, venda } = ambiente;
  pulso.estornarVenda({ requisicaoId: 'V-EST-D', vendaId: venda.vendaId, motivo: 'Devolução fictícia' });
  const e = intencao(armazenamento, 'V-EST-D');
  const p = JSON.parse(e.payload);
  p.registros[1].linha.delta_unidades = 1;
  e.payload = JSON.stringify(p);
  armazenamento.tabelas.MOVIMENTOS_ESTOQUE.find((m) => m.movimento_id === p.registros[1].linha.movimento_id).delta_unidades = 1;
  assert.equal(pulso.listarVendas({}).erro.codigo, 'DADOS_INCONSISTENTES');
});

// ---------------------------------------------------------------- reconciliações do docs/03 seção 12.3

test('reconciliações: Σ movimentos = saldo, Σ subtotais = total, Σ VENDA = −Σ itens confirmados, respeitando estornos', () => {
  const { pulso, armazenamento } = ambienteDeVenda();
  const v1 = pulso.confirmarVenda(VENDA);
  pulso.confirmarVenda({ ...VENDA, requisicaoId: 'V-R2', itens: [{ sku: 'MER-001', quantidade: 2 }] });
  pulso.estornarVenda({ requisicaoId: 'V-R-EST', vendaId: v1.vendaId, motivo: 'Devolução fictícia' });
  const t = armazenamento.tabelas;
  for (const sku of ['MER-001', 'MER-002']) {
    assert.equal(saldo(pulso, sku), t.MOVIMENTOS_ESTOQUE.filter((m) => m.sku === sku).reduce((s, m) => s + m.delta_unidades, 0));
    const vendido = t.ITENS_VENDA.filter((i) => i.sku === sku).reduce((s, i) => s + i.quantidade, 0);
    const devolvido = t.MOVIMENTOS_ESTOQUE.filter((m) => m.sku === sku && m.tipo === 'ESTORNO').reduce((s, m) => s + m.delta_unidades, 0);
    const baixas = t.MOVIMENTOS_ESTOQUE.filter((m) => m.sku === sku && m.tipo === 'VENDA').reduce((s, m) => s + m.delta_unidades, 0);
    assert.equal(baixas, -vendido);
    assert.equal(baixas + devolvido, devolvido - vendido);
  }
  for (const venda of t.VENDAS) {
    assert.equal(t.ITENS_VENDA.filter((i) => i.venda_id === venda.venda_id).reduce((s, i) => s + i.subtotal_centavos, 0), venda.total_centavos);
  }
});

// ---------------------------------------------------------------- concorrência real (T19)

function cliAssincrona(pasta, ...args) {
  return new Promise((resolver) => {
    const filho = spawn(process.execPath, [CLI, ...args], { env: { ...process.env, PULSO_DADOS: pasta }, stdio: 'ignore' });
    filho.on('close', resolver);
  });
}
function pastaComEstoque(t, unidades) {
  const pasta = fs.mkdtempSync(path.join(os.tmpdir(), 'pulso-vendas-concorrencia-'));
  t.after(() => fs.rmSync(pasta, { recursive: true, force: true }));
  const pulso = criarPulsoLocal(pasta);
  aplicarCatalogo(pulso);
  assert.equal(pulso.registrarEntrada({ requisicaoId: 'CONC-ENT', sku: 'MER-001', quantidade: unidades, custoUnitCentavos: 160, fornecedorId: 'FOR-001' }).ok, true);
  return pasta;
}

test('T19: vendas concorrentes acima do saldo — só cabem as que o estoque comporta', async (t) => {
  const pasta = pastaComEstoque(t, 10);
  const codigos = await Promise.all(Array.from({ length: 8 }, (_, i) =>
    cliAssincrona(pasta, 'venda', '--item', 'MER-001=3', '--pagamento', 'PIX', '--requisicao', `CONC-V-${i}`)));
  assert.equal(codigos.filter((c) => c === 0).length, 3, JSON.stringify(codigos));
  const pulso = criarPulsoLocal(pasta);
  assert.equal(pulso.consultarEstoque({ sku: 'MER-001' }).saldoAtual, 1);
  assert.equal(pulso.listarVendas({}).vendas.length, 3);
});

test('T19: duas vendas concorrentes de seis sobre saldo dez confirmam apenas uma', async (t) => {
  const pasta = pastaComEstoque(t, 10);
  const codigos = await Promise.all(['A', 'B'].map((s) =>
    cliAssincrona(pasta, 'venda', '--item', 'MER-001=6', '--pagamento', 'PIX', '--requisicao', `CONC-DUAS-${s}`)));
  assert.equal(codigos.filter((c) => c === 0).length, 1);
  assert.equal(criarPulsoLocal(pasta).consultarEstoque({ sku: 'MER-001' }).saldoAtual, 4);
});

test('concorrência real: a mesma venda e o mesmo estorno disparados várias vezes gravam uma única vez', async (t) => {
  const pasta = pastaComEstoque(t, 10);
  const vendas = await Promise.all(Array.from({ length: 6 }, () =>
    cliAssincrona(pasta, 'venda', '--item', 'MER-001=2', '--pagamento', 'DINHEIRO', '--requisicao', 'CONC-MESMA')));
  assert.deepEqual(vendas, Array(6).fill(0));
  let pulso = criarPulsoLocal(pasta);
  const venda = pulso.consultarVenda({ requisicaoId: 'CONC-MESMA' }).venda.vendaId;
  const estornos = await Promise.all(Array.from({ length: 6 }, (_, i) =>
    cliAssincrona(pasta, 'estorno', '--venda', venda, '--motivo', 'Devolução fictícia', '--requisicao', `CONC-EST-${i}`)));
  assert.equal(estornos.filter((c) => c === 0).length, 1, JSON.stringify(estornos));
  pulso = criarPulsoLocal(pasta);
  assert.equal(pulso.listarVendas({}).vendas.length, 1);
  assert.equal(pulso.consultarVenda({ vendaId: venda }).venda.estado, 'ESTORNADA');
  assert.equal(pulso.consultarEstoque({ sku: 'MER-001' }).saldoAtual, 10);
});

// ---------------------------------------------------------------- CLI

test('CLI: venda, vendas, ver-venda e estorno de ponta a ponta', (t) => {
  const pasta = pastaComEstoque(t, 10);
  const cli = (...args) => require('node:child_process').spawnSync(process.execPath, [CLI, ...args], { encoding: 'utf8', env: { ...process.env, PULSO_DADOS: pasta } });
  const venda = cli('venda', '--item', 'MER-001=2', '--pagamento', 'PIX', '--requisicao', 'CLI-V1');
  assert.equal(venda.status, 0, venda.stderr);
  const id = /(VEN-\S+)/.exec(venda.stdout)[1];
  assert.match(venda.stdout, /Total R\$\s*4,00/);
  assert.match(cli('vendas').stdout, new RegExp(`${id}.*CONFIRMADA`));
  assert.match(cli('ver-venda', '--id', id).stdout, /MER-001 .*2 un/);
  assert.match(cli('venda', '--id', id).stdout, /MER-001 .*2 un/);
  assert.equal(cli('estorno', '--venda', id, '--motivo', 'Devolução fictícia').status, 0);
  assert.match(cli('vendas').stdout, new RegExp(`${id}.*ESTORNADA`));
  assert.match(cli('venda', '--item', 'MER-001=99', '--pagamento', 'PIX').stderr, /SALDO_INSUFICIENTE/);
});
