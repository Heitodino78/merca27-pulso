'use strict';
/* Fase 3: indicadores por período, política temporal de estornos, resumo diário e reconciliação independente. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { criarAmbiente, PRODUTO_BASE } = require('./apoio');
const { carregarNucleo } = require('../local/nucleo');

const { indicadores: IND } = carregarNucleo();
const simples = (v) => JSON.parse(JSON.stringify(v));

/**
 * Ambiente com relógio controlado. MER-001: preço 990, custo 600, saldo 100.
 * MER-002: preço 500, custo 300, saldo 50. Cadastros às 12:00 UTC de 01/11/2026.
 */
function ambiente() {
  const relogio = { agora: Date.UTC(2026, 10, 1, 12, 0, 0) };
  const amb = criarAmbiente({ relogio: () => new Date(relogio.agora++).toISOString() });
  const ok = (r) => { assert.equal(r.ok, true, JSON.stringify(r)); return r; };
  ok(amb.pulso.cadastrarProduto({ ...PRODUTO_BASE, requisicaoId: 'I-CAD-1', sku: 'MER-001', precoVendaCentavos: 990, custoRefCentavos: 600 }));
  ok(amb.pulso.cadastrarProduto({ ...PRODUTO_BASE, requisicaoId: 'I-CAD-2', sku: 'MER-002', nome: 'Produto Fictício Dois', precoVendaCentavos: 500, custoRefCentavos: 300 }));
  ok(amb.pulso.registrarEntrada({ requisicaoId: 'I-ENT-1', sku: 'MER-001', quantidade: 100, custoUnitCentavos: 600, fornecedorId: 'FOR-001' }));
  ok(amb.pulso.registrarEntrada({ requisicaoId: 'I-ENT-2', sku: 'MER-002', quantidade: 50, custoUnitCentavos: 300, fornecedorId: 'FOR-001' }));
  let n = 0;
  /** Executa a ação no instante ISO informado (o relógio avança 1 ms por chamada). */
  const em = (iso, funcao) => { relogio.agora = Date.parse(iso); return ok(funcao()); };
  const vender = (iso, itens, extra = {}) => em(iso, () => amb.pulso.confirmarVenda({ requisicaoId: `I-V-${++n}`, formaPagamentoFicticia: 'PIX', itens, ...extra }));
  const estornar = (iso, vendaId) => em(iso, () => amb.pulso.estornarVenda({ requisicaoId: `I-E-${++n}`, vendaId, motivo: 'Devolução fictícia' }));
  return { ...amb, relogio, ok, em, vender, estornar };
}

/** Período de dias civis de São Paulo, ambos inclusivos. */
const dias = (de, ate = de) => ({ desde: IND.inicioDoDia(de), ate: IND.inicioDoDia(IND.diaSeguinte(ate)) });

// ---------------------------------------------------------------- fuso e fronteiras

test('fuso de São Paulo: a meia-noite local é 03:00 UTC, nos dois sentidos', () => {
  assert.equal(IND.inicioDoDia('2026-11-19'), '2026-11-19T03:00:00.000Z');
  assert.equal(IND.diaLocal('2026-11-20T02:59:59.999Z'), '2026-11-19');
  assert.equal(IND.diaLocal('2026-11-20T03:00:00.000Z'), '2026-11-20');
  assert.equal(IND.diaSeguinte('2026-12-31'), '2027-01-01');
  assert.equal(IND.diaSeguinte('2028-02-28'), '2028-02-29');
  for (const dia of ['2026-02-30', '2026-13-01', '19-11-2026', '2026-11-19T00:00', '', null]) assert.equal(IND.diaValido(dia), false, String(dia));
});

test('venda às 23:59:59.999 de São Paulo fica no dia; à meia-noite, no dia seguinte', () => {
  const a = ambiente();
  a.vender('2026-11-20T02:59:59.999Z', [{ sku: 'MER-001', quantidade: 1 }]);
  a.vender('2026-11-20T03:00:00.000Z', [{ sku: 'MER-002', quantidade: 1 }]);
  const d19 = a.pulso.consultarIndicadores(dias('2026-11-19'));
  const d20 = a.pulso.consultarIndicadores(dias('2026-11-20'));
  assert.equal(d19.resultado.receitaBrutaCentavos, 990);
  assert.equal(d20.resultado.receitaBrutaCentavos, 500);
  assert.deepEqual(simples(d19.serie.map((s) => s.dia)), ['2026-11-19']);
});

test('início inclusivo e fim exclusivo, com instantes exatos', () => {
  const a = ambiente();
  const v = a.vender('2026-11-10T15:00:00.000Z', [{ sku: 'MER-001', quantidade: 2 }]);
  const instante = a.pulso.consultarVenda({ vendaId: v.vendaId }).venda.registradoEm;
  assert.equal(a.pulso.consultarIndicadores({ desde: instante, ate: '2026-11-11T00:00:00.000Z' }).vendas.numero, 1);
  assert.equal(a.pulso.consultarIndicadores({ desde: '2026-11-01T00:00:00.000Z', ate: instante }).vendas.numero, 0);
});

// ---------------------------------------------------------------- T15 / T16

test('T16: base sem vendas e período vazio têm zeros e N/D, sem divisão por zero', () => {
  const vazio = criarAmbiente();
  const r = vazio.pulso.consultarIndicadores(dias('2026-11-01', '2026-11-07'));
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.vendas.numero, 0);
  assert.equal(r.resultado.receitaBrutaCentavos, 0);
  assert.equal(r.resultado.ticketMedioCentavos, null);
  assert.equal(r.resultado.margemPercentual, null);
  assert.equal(r.serie.length, 7);
  assert.deepEqual(simples(r.produtosMaisVendidos), []);
  assert.equal(ambiente().pulso.consultarIndicadores(dias('2025-01-01')).vendas.numero, 0);
});

test('T15: receita, CMV, margem e ticket em centavos coerentes com as vendas', () => {
  const a = ambiente();
  a.vender('2026-11-10T15:00:00.000Z', [{ sku: 'MER-001', quantidade: 3 }, { sku: 'MER-002', quantidade: 2 }]); // 3970 / 2400
  a.vender('2026-11-10T16:00:00.000Z', [{ sku: 'MER-002', quantidade: 1 }]); // 500 / 300
  const r = a.pulso.consultarIndicadores(dias('2026-11-10'));
  assert.equal(r.vendas.numero, 2);
  assert.equal(r.vendas.unidades, 6);
  assert.equal(r.resultado.receitaBrutaCentavos, 4470);
  assert.equal(r.resultado.cmvEstimadoCentavos, 2700);
  assert.equal(r.resultado.margemBrutaCentavos, 1770);
  assert.equal(r.resultado.margemPercentual, 39.6); // 1770 / 4470 = 39,597…%
  assert.equal(r.resultado.ticketMedioCentavos, 2235);
  assert.deepEqual(simples(r.produtosMaisVendidos.map((p) => [p.sku, p.unidadesVendidas, p.receitaBrutaCentavos, p.cmvCentavos])),
    [['MER-001', 3, 2970, 1800], ['MER-002', 3, 1500, 900]]);
  assert.equal(r.produtosMaisVendidos[0].nome, PRODUTO_BASE.nome);
});

test('preço e custo alterados depois não mudam os indicadores de vendas antigas', () => {
  const a = ambiente();
  a.vender('2026-11-10T15:00:00.000Z', [{ sku: 'MER-001', quantidade: 1 }]);
  a.em('2026-11-11T15:00:00.000Z', () => a.pulso.alterarProduto({ requisicaoId: 'I-ALT', sku: 'MER-001', motivo: 'Reajuste fictício', campos: { precoVendaCentavos: 2000, custoRefCentavos: 1500 } }));
  const r = a.pulso.consultarIndicadores(dias('2026-11-10'));
  assert.equal(r.resultado.receitaBrutaCentavos, 990);
  assert.equal(r.resultado.cmvEstimadoCentavos, 600);
});

// ---------------------------------------------------------------- política de estornos (D-063)

test('venda e estorno no mesmo período: bruta mantém a venda, devolução a anula', () => {
  const a = ambiente();
  const v = a.vender('2026-11-10T15:00:00.000Z', [{ sku: 'MER-001', quantidade: 2 }]);
  a.estornar('2026-11-10T18:00:00.000Z', v.vendaId);
  const r = a.pulso.consultarIndicadores(dias('2026-11-10'));
  assert.equal(r.vendas.numero, 1);
  assert.equal(r.vendas.estornadasDepois, 1);
  assert.equal(r.resultado.receitaBrutaCentavos, 1980);
  assert.equal(r.resultado.devolucoesCentavos, 1980);
  assert.equal(r.resultado.receitaAposDevolucoesCentavos, 0);
  assert.equal(r.resultado.margemBrutaCentavos, 0);
  assert.equal(r.resultado.margemPercentual, null);
  assert.equal(r.resultado.ticketMedioCentavos, 1980, 'ticket usa vendas brutas do período');
  assert.equal(r.devolucoes.deVendasAnteriores, 0);
});

test('estorno em período posterior: a venda histórica não some, e o período só com estornos fica negativo', () => {
  const a = ambiente();
  const v = a.vender('2026-11-10T15:00:00.000Z', [{ sku: 'MER-001', quantidade: 2 }]);
  a.estornar('2026-11-12T15:00:00.000Z', v.vendaId);
  const antes = a.pulso.consultarIndicadores(dias('2026-11-10'));
  assert.equal(antes.resultado.receitaBrutaCentavos, 1980);
  assert.equal(antes.resultado.devolucoesCentavos, 0);
  assert.equal(antes.resultado.receitaAposDevolucoesCentavos, 1980);
  assert.equal(antes.vendas.estornadasDepois, 1);
  const depois = a.pulso.consultarIndicadores(dias('2026-11-12'));
  assert.equal(depois.vendas.numero, 0);
  assert.equal(depois.resultado.devolucoesCentavos, 1980);
  assert.equal(depois.resultado.receitaAposDevolucoesCentavos, -1980);
  assert.equal(depois.resultado.cmvEstimadoCentavos, -1200);
  assert.equal(depois.resultado.margemBrutaCentavos, -780);
  assert.equal(depois.resultado.margemPercentual, null);
  assert.equal(depois.resultado.ticketMedioCentavos, null);
  assert.equal(depois.devolucoes.deVendasAnteriores, 1);
  const tudo = a.pulso.consultarIndicadores(dias('2026-11-10', '2026-11-12'));
  assert.equal(tudo.resultado.receitaAposDevolucoesCentavos, 0);
  assert.deepEqual(simples(tudo.serie.map((s) => [s.dia, s.receitaBrutaCentavos, s.devolucoesCentavos])),
    [['2026-11-10', 1980, 0], ['2026-11-11', 0, 0], ['2026-11-12', 0, 1980]]);
});

test('estorno usa o custo capturado mesmo depois de reajuste do cadastro', () => {
  const a = ambiente();
  const v = a.vender('2026-11-10T15:00:00.000Z', [{ sku: 'MER-001', quantidade: 1 }]);
  a.em('2026-11-11T15:00:00.000Z', () => a.pulso.alterarProduto({ requisicaoId: 'I-ALT-2', sku: 'MER-001', motivo: 'Reajuste fictício', campos: { custoRefCentavos: 900 } }));
  a.estornar('2026-11-12T15:00:00.000Z', v.vendaId);
  assert.equal(a.pulso.consultarIndicadores(dias('2026-11-12')).devolucoes.cmvCentavos, 600);
});

// ---------------------------------------------------------------- perdas, ajustes, entradas e estoque

test('perdas, ajustes e entradas aparecem separados de vendas, com custo gravado', () => {
  const a = ambiente();
  a.em('2026-11-10T15:00:00.000Z', () => a.pulso.registrarPerda({ requisicaoId: 'I-P1', sku: 'MER-001', quantidade: 2, categoriaPerda: 'AVARIA', motivo: 'Avaria fictícia' }));
  a.em('2026-11-10T16:00:00.000Z', () => a.pulso.registrarPerda({ requisicaoId: 'I-P2', sku: 'MER-002', quantidade: 3, categoriaPerda: 'VENCIMENTO', motivo: 'Vencimento fictício' }));
  a.em('2026-11-10T17:00:00.000Z', () => a.pulso.ajustarPorContagem({ requisicaoId: 'I-A1', sku: 'MER-002', quantidadeContada: 50, motivo: 'Contagem fictícia' }));
  a.em('2026-11-10T18:00:00.000Z', () => a.pulso.registrarEntrada({ requisicaoId: 'I-ENT-3', sku: 'MER-002', quantidade: 4, custoUnitCentavos: 250, fornecedorId: 'FOR-001' }));
  const r = a.pulso.consultarIndicadores(dias('2026-11-10'));
  assert.equal(r.vendas.numero, 0);
  assert.equal(r.perdas.unidades, 5);
  assert.equal(r.perdas.valorCentavos, 2 * 600 + 3 * 300);
  assert.deepEqual(simples(r.perdas.porCategoria), { AVARIA: { unidades: 2, valorCentavos: 1200 }, VENCIMENTO: { unidades: 3, valorCentavos: 900 }, QUEBRA: { unidades: 0, valorCentavos: 0 } });
  assert.deepEqual(simples(r.ajustes), { numero: 1, unidadesAcrescidas: 3, unidadesRetiradas: 0, valorLiquidoCentavos: 900 });
  assert.deepEqual(simples(r.entradas), { numero: 1, unidades: 4, valorCentavos: 1000 });
  assert.equal(r.serie[0].perdasUnidades, 5);
  assert.equal(r.estoqueAtual.unidades, 98 + 54);
  assert.equal(r.estoqueAtual.valorCentavos, 98 * 600 + 54 * 300);
  assert.match(r.formulas.valorEstoque, /ATUAL/);
});

test('reposição dos indicadores segue a mesma regra da consulta de reposição', () => {
  const a = ambiente();
  a.vender('2026-11-10T15:00:00.000Z', [{ sku: 'MER-002', quantidade: 46 }]);
  const r = a.pulso.consultarIndicadores(dias('2026-11-10'));
  const consulta = a.pulso.consultarReposicao();
  assert.equal(r.reposicao.quantidade, consulta.itens.length);
  assert.deepEqual(simples(r.reposicao.itens), simples(consulta.itens));
  assert.equal(r.estoqueAtual.abaixoDoMinimo, 1);
});

// ---------------------------------------------------------------- volume, pendências, integridade

test('indicadores usam o estado completo, além do limite de 100 de listarVendas', () => {
  const a = ambiente();
  // 50 vendas de MER-002 e 80 de MER-001, uma unidade cada.
  for (let i = 0; i < 130; i++) a.vender(new Date(Date.UTC(2026, 10, 10, 13, 0, i)).toISOString(), [{ sku: i < 50 ? 'MER-002' : 'MER-001', quantidade: 1 }]);
  assert.equal(a.pulso.listarVendas({}).vendas.length, 100);
  const r = a.pulso.consultarIndicadores(dias('2026-11-10'));
  assert.equal(r.vendas.numero, 130);
  assert.equal(r.resultado.receitaBrutaCentavos, 50 * 500 + 80 * 990);
  assert.equal(r.origem.vendaIds.length, 130);
});

test('reconciliação independente: totais e série batem com cálculo direto das tabelas confirmadas', () => {
  const a = ambiente();
  const vendas = [];
  for (let d = 0; d < 6; d++) {
    const dia = `2026-11-${String(10 + d).padStart(2, '0')}`;
    vendas.push(a.vender(`${dia}T14:00:00.000Z`, [{ sku: 'MER-001', quantidade: 1 + (d % 3) }, { sku: 'MER-002', quantidade: 1 }]));
    if (d % 2) a.em(`${dia}T15:00:00.000Z`, () => a.pulso.registrarPerda({ requisicaoId: `I-PER-${d}`, sku: 'MER-001', quantidade: 1, categoriaPerda: 'QUEBRA', motivo: 'Quebra fictícia' }));
  }
  a.estornar('2026-11-13T20:00:00.000Z', vendas[0].vendaId);
  a.estornar('2026-11-16T20:00:00.000Z', vendas[4].vendaId);
  // Uma venda incompleta não pode entrar.
  a.armazenamento.falharNaProxima('MOVIMENTOS_ESTOQUE', 'antes', (l) => l.tipo === 'VENDA');
  a.relogio.agora = Date.parse('2026-11-12T12:00:00.000Z');
  assert.equal(a.pulso.confirmarVenda({ requisicaoId: 'I-PEND', formaPagamentoFicticia: 'PIX', itens: [{ sku: 'MER-001', quantidade: 9 }] }).ok, false);

  const periodo = dias('2026-11-11', '2026-11-14');
  const r = a.pulso.consultarIndicadores(periodo);
  assert.equal(r.operacoesPendentes, 1);
  assert.equal(r.avisos.length, 1);

  // Cálculo direto, sem passar pelo núcleo.
  const t = a.armazenamento.tabelas;
  const confirmadas = new Set(t.OPERACOES_LOG.filter((e) => e.estado === 'CONFIRMADA').map((e) => e.operacao_id));
  const noPeriodo = (iso) => iso >= periodo.desde && iso < periodo.ate;
  const vendasOk = t.VENDAS.filter((v) => confirmadas.has(v.operacao_id));
  const bruta = vendasOk.filter((v) => noPeriodo(v.registrado_em)).reduce((s, v) => s + v.total_centavos, 0);
  const devol = t.ESTORNOS_VENDA.filter((e) => confirmadas.has(e.operacao_id) && noPeriodo(e.registrado_em))
    .reduce((s, e) => s + vendasOk.find((v) => v.venda_id === e.venda_id).total_centavos, 0);
  const perdas = t.MOVIMENTOS_ESTOQUE.filter((m) => confirmadas.has(m.operacao_id) && m.tipo === 'PERDA' && noPeriodo(m.registrado_em))
    .reduce((s, m) => s - m.delta_unidades, 0);
  assert.equal(r.resultado.receitaBrutaCentavos, bruta);
  assert.equal(r.resultado.devolucoesCentavos, devol);
  assert.equal(r.resultado.receitaAposDevolucoesCentavos, bruta - devol);
  assert.equal(r.perdas.unidades, perdas);
  assert.equal(r.serie.reduce((s, d) => s + d.receitaBrutaCentavos, 0), bruta);
  assert.equal(r.serie.reduce((s, d) => s + d.devolucoesCentavos, 0), devol);
  assert.equal(r.serie.reduce((s, d) => s + d.numeroVendas, 0), r.vendas.numero);
  assert.equal(r.produtosMaisVendidos.reduce((s, p) => s + p.receitaBrutaCentavos, 0), bruta);
  assert.ok(!r.origem.vendaIds.some((id) => id.includes('I-PEND')));
});

test('adulteração continua detectada pelos indicadores', () => {
  const a = ambiente();
  a.vender('2026-11-10T15:00:00.000Z', [{ sku: 'MER-001', quantidade: 2 }]);
  a.armazenamento.tabelas.VENDAS[0].total_centavos = 1;
  assert.equal(a.pulso.consultarIndicadores(dias('2026-11-10')).erro.codigo, 'DADOS_INCONSISTENTES');
  assert.equal(a.pulso.gerarResumoDiario({ dia: '2026-11-10' }).erro.codigo, 'DADOS_INCONSISTENTES');
});

test('valor fora do limite de inteiros exatos é recusado, nunca arredondado', () => {
  const a = ambiente();
  a.em('2026-11-10T15:00:00.000Z', () => a.pulso.ajustarPorContagem({ requisicaoId: 'I-MAX', sku: 'MER-001', quantidadeContada: Number.MAX_SAFE_INTEGER, motivo: 'Limite sintético' }));
  assert.equal(a.pulso.consultarIndicadores(dias('2026-11-10')).erro.codigo, 'INDICADOR_FORA_DO_LIMITE');
});

for (const pedido of [undefined, null, {}, { desde: '2026-11-01T00:00:00.000Z' }, { desde: '2026-11-02T00:00:00.000Z', ate: '2026-11-01T00:00:00.000Z' },
  { desde: '2026-11-01T00:00:00.000Z', ate: '2026-11-01T00:00:00.000Z' }, { desde: '2026-11-01', ate: '2026-11-02' },
  { desde: '2026-02-30T00:00:00.000Z', ate: '2026-03-02T00:00:00.000Z' }, { desde: '2025-01-01T00:00:00.000Z', ate: '2026-01-03T00:00:00.000Z' },
  { desde: '2026-11-01T00:00:00.000Z', ate: '2026-11-02T00:00:00.000Z', limite: 5 }]) {
  test(`período inválido é recusado sem ler nem gravar: ${JSON.stringify(pedido)}`, () => {
    const a = ambiente();
    const antes = JSON.stringify(a.armazenamento.tabelas);
    assert.equal(a.pulso.consultarIndicadores(pedido).erro.codigo, 'DADOS_INVALIDOS');
    assert.equal(JSON.stringify(a.armazenamento.tabelas), antes);
  });
}

test('período de exatamente 366 dias é aceito', () => {
  assert.equal(criarAmbiente().pulso.consultarIndicadores({ desde: '2025-11-19T03:00:00.000Z', ate: '2026-11-20T03:00:00.000Z' }).ok, true);
});

test('consultas de indicadores não gravam nada, nem rejeição no log', () => {
  const a = ambiente();
  a.vender('2026-11-10T15:00:00.000Z', [{ sku: 'MER-001', quantidade: 2 }]);
  const antes = JSON.stringify(a.armazenamento.tabelas);
  a.pulso.consultarIndicadores(dias('2026-11-10'));
  a.pulso.gerarResumoDiario({ dia: '2026-11-10' });
  a.pulso.gerarResumoDiario({ dia: 'ontem' });
  assert.equal(JSON.stringify(a.armazenamento.tabelas), antes);
});

// ---------------------------------------------------------------- resumo diário

test('resumo diário reconcilia com os indicadores do mesmo dia e prepara o texto sem enviar', () => {
  const a = ambiente();
  a.vender('2026-11-10T15:00:00.000Z', [{ sku: 'MER-002', quantidade: 46 }]);
  a.em('2026-11-10T16:00:00.000Z', () => a.pulso.registrarPerda({ requisicaoId: 'I-RP', sku: 'MER-001', quantidade: 1, categoriaPerda: 'AVARIA', motivo: 'Avaria fictícia' }));
  a.relogio.agora = Date.parse('2026-11-11T12:00:00.000Z');
  const r = a.pulso.gerarResumoDiario({ dia: '2026-11-10' });
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.desde, '2026-11-10T03:00:00.000Z');
  assert.equal(r.ate, '2026-11-11T03:00:00.000Z');
  assert.equal(r.diaEmAndamento, false);
  assert.deepEqual(simples(r.indicadores.resultado), simples(a.pulso.consultarIndicadores(dias('2026-11-10')).resultado));
  assert.deepEqual(simples(r.reposicao.map((i) => [i.sku, i.sugestaoUnidades])), [['MER-002', 8]]);
  assert.match(r.texto, /resumo operacional de 2026-11-10/);
  assert.match(r.texto, /receita bruta R\$ 230,00/);
  assert.match(r.texto, /Perdas: 1 un\., R\$ 6,00/);
  assert.match(r.texto, /MER-002 \(\+8\)/);
  assert.match(r.texto, /Sem operações pendentes/);
});

test('resumo do dia corrente avisa que é parcial e mostra pendências', () => {
  const a = ambiente();
  a.armazenamento.falharNaProxima('MOVIMENTOS_ESTOQUE', 'antes', (l) => l.tipo === 'VENDA');
  a.relogio.agora = Date.parse('2026-11-10T15:00:00.000Z');
  assert.equal(a.pulso.confirmarVenda({ requisicaoId: 'I-RP-PEND', formaPagamentoFicticia: 'PIX', itens: [{ sku: 'MER-001', quantidade: 1 }] }).ok, false);
  const r = a.pulso.gerarResumoDiario({ dia: '2026-11-10' });
  assert.equal(r.diaEmAndamento, true);
  assert.equal(r.operacoesPendentes, 1);
  assert.equal(r.indicadores.vendas.numero, 0);
  assert.match(r.texto, /valores parciais/);
  assert.match(r.texto, /ATENÇÃO: 1 operação/);
});

for (const pedido of [undefined, {}, { dia: '2026-02-30' }, { dia: '10/11/2026' }, { dia: '2026-11-10', extra: 1 }]) {
  test(`resumo recusa dia inválido: ${JSON.stringify(pedido)}`, () => {
    assert.equal(ambiente().pulso.gerarResumoDiario(pedido).erro.codigo, 'DADOS_INVALIDOS');
  });
}

// ---------------------------------------------------------------- despacho e CLI

test('despacho expõe consultarIndicadores, mas não o resumo diário', () => {
  const a = ambiente();
  const { despacho } = carregarNucleo();
  assert.equal(despacho.despachar(a.pulso, 'consultarIndicadores', dias('2026-11-10')).ok, true);
  assert.equal(despacho.despachar(a.pulso, 'consultarIndicadores').erro.codigo, 'DADOS_INVALIDOS');
  assert.equal(despacho.despachar(a.pulso, 'gerarResumoDiario', { dia: '2026-11-10' }).erro.codigo, 'ACAO_DESCONHECIDA');
});

test('CLI: indicadores e resumo de ponta a ponta', (t) => {
  const pasta = fs.mkdtempSync(path.join(os.tmpdir(), 'pulso-cli-indicadores-'));
  t.after(() => fs.rmSync(pasta, { recursive: true, force: true }));
  const cli = (...args) => spawnSync(process.execPath, [path.join(__dirname, '..', 'local', 'cli.js'), ...args], { encoding: 'utf8', env: { ...process.env, PULSO_DADOS: pasta } });
  assert.equal(cli('seed').status, 0);
  assert.equal(cli('entrada', '--sku', 'MER-001', '--quantidade', '10', '--custo', '160', '--fornecedor', 'FOR-001').status, 0);
  assert.equal(cli('venda', '--item', 'MER-001=3', '--pagamento', 'PIX').status, 0);
  const hoje = IND.diaLocal(new Date().toISOString());
  const r = cli('indicadores', '--de', hoje, '--ate', hoje);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /Vendas: 1 \(3 un\.\)/);
  assert.match(r.stdout, /Receita bruta R\$\s*6,00/);
  assert.match(cli('resumo').stdout, /resumo operacional de/);
  assert.equal(cli('indicadores', '--de', '2026-11-10', '--ate', '2026-11-01').status, 1);
  assert.match(cli('resumo', '--dia', '2026-02-30').stderr, /DADOS_INVALIDOS/);
});
