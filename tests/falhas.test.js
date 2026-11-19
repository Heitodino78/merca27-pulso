'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { ambienteComProduto, eventos, saldoRecalculado } = require('./apoio');

const ENTRADA = Object.freeze({ custoUnitCentavos: 600, fornecedorId: 'FOR-001', requisicaoId: 'REQ-F1', sku: 'MER-001', quantidade: 10 });
const saldo = (pulso) => pulso.consultarEstoque({ sku: 'MER-001' }).saldoAtual;
const confirmacao = (linha) => linha.estado === 'CONFIRMADA';
const intencao = (linha) => linha.estado === 'PENDENTE';

// Cada ponto de falha do protocolo intenção -> dado -> confirmação.
const PONTOS = [
  ['intenção falha antes de gravar', 'OPERACOES_LOG', 'antes', intencao, 0],
  ['intenção grava e acusa erro', 'OPERACOES_LOG', 'depois', intencao, 0],
  ['intenção é descartada em silêncio', 'OPERACOES_LOG', 'silencioso', intencao, 0],
  ['movimento falha antes de gravar', 'MOVIMENTOS_ESTOQUE', 'antes', undefined, 0],
  ['movimento grava e acusa erro', 'MOVIMENTOS_ESTOQUE', 'depois', undefined, 1],
  ['movimento é descartado em silêncio', 'MOVIMENTOS_ESTOQUE', 'silencioso', undefined, 0],
  ['confirmação falha antes de gravar', 'OPERACOES_LOG', 'antes', confirmacao, 1],
  ['confirmação é descartada em silêncio', 'OPERACOES_LOG', 'silencioso', confirmacao, 1],
];

for (const [nome, tabela, modo, filtro, movimentosAposFalha] of PONTOS) {
  test(`${nome}: não anuncia sucesso e a repetição aplica exatamente uma vez`, () => {
    const { pulso, armazenamento } = ambienteComProduto();
    armazenamento.falharNaProxima(tabela, modo, filtro);

    const falha = pulso.registrarEntrada({ custoUnitCentavos: 600, fornecedorId: 'FOR-001', ...ENTRADA });
    assert.equal(falha.ok, false);
    assert.equal(falha.erro.codigo, 'FALHA_GRAVACAO');
    assert.equal(armazenamento.tabelas.MOVIMENTOS_ESTOQUE.length, movimentosAposFalha);
    assert.equal(saldo(pulso), 0, 'movimento sem confirmação não pode compor o saldo');

    const repeticao = pulso.registrarEntrada({ custoUnitCentavos: 600, fornecedorId: 'FOR-001', ...ENTRADA });
    assert.equal(repeticao.ok, true);
    assert.equal(repeticao.saldoAtual, 10);
    assert.equal(armazenamento.tabelas.MOVIMENTOS_ESTOQUE.length, 1);

    assert.equal(pulso.registrarEntrada({ custoUnitCentavos: 600, fornecedorId: 'FOR-001', ...ENTRADA }).duplicada, true);
    assert.equal(saldo(pulso), 10);
    assert.equal(saldoRecalculado(armazenamento, 'MER-001'), 10);
  });
}

test('confirmação gravada com erro de retorno: repetição apenas devolve a operação', () => {
  const { pulso, armazenamento } = ambienteComProduto();
  armazenamento.falharNaProxima('OPERACOES_LOG', 'depois', confirmacao);
  assert.equal(pulso.registrarEntrada({ custoUnitCentavos: 600, fornecedorId: 'FOR-001', ...ENTRADA }).ok, false);
  const repeticao = pulso.registrarEntrada({ custoUnitCentavos: 600, fornecedorId: 'FOR-001', ...ENTRADA });
  assert.equal(repeticao.ok, true);
  assert.equal(armazenamento.tabelas.MOVIMENTOS_ESTOQUE.length, 1);
  assert.equal(saldo(pulso), 10);
});

test('operação interrompida bloqueia novos lançamentos até a reconciliação', () => {
  const { pulso, armazenamento } = ambienteComProduto();
  armazenamento.falharNaProxima('MOVIMENTOS_ESTOQUE', 'antes');
  pulso.registrarEntrada({ custoUnitCentavos: 600, fornecedorId: 'FOR-001', ...ENTRADA });
  assert.equal(eventos(armazenamento, 'PENDENTE_RECONCILIACAO').length, 1);

  const bloqueada = pulso.registrarEntrada({ custoUnitCentavos: 600, fornecedorId: 'FOR-001', requisicaoId: 'REQ-F2', sku: 'MER-001', quantidade: 1 });
  assert.equal(bloqueada.erro.codigo, 'RECONCILIACAO_PENDENTE');
  assert.equal(pulso.consultarEstoque({ sku: 'MER-001' }).operacoesPendentes, 1);

  const reconciliacao = pulso.reconciliarPendencias();
  assert.equal(reconciliacao.ok, true);
  assert.deepEqual(Array.from(reconciliacao.reconciliadas), ['REQ-F1']);
  assert.equal(saldo(pulso), 10);
  assert.equal(pulso.registrarEntrada({ custoUnitCentavos: 600, fornecedorId: 'FOR-001', requisicaoId: 'REQ-F2', sku: 'MER-001', quantidade: 1 }).saldoAtual, 11);
  assert.equal(pulso.reconciliarPendencias().reconciliadas.length, 0);
});

test('reconciliação que também falha mantém a operação pendente e pode ser repetida', () => {
  const { pulso, armazenamento } = ambienteComProduto();
  armazenamento.falharNaProxima('MOVIMENTOS_ESTOQUE', 'antes');
  pulso.registrarEntrada({ custoUnitCentavos: 600, fornecedorId: 'FOR-001', ...ENTRADA });
  armazenamento.falharNaProxima('MOVIMENTOS_ESTOQUE', 'antes');
  assert.equal(pulso.reconciliarPendencias().ok, false);
  assert.equal(saldo(pulso), 0);
  assert.equal(pulso.reconciliarPendencias().ok, true);
  assert.equal(saldo(pulso), 10);
  assert.equal(armazenamento.tabelas.MOVIMENTOS_ESTOQUE.length, 1);
});

test('repetição conflitante de operação pendente é rejeitada sem concluir nada', () => {
  const { pulso, armazenamento } = ambienteComProduto();
  armazenamento.falharNaProxima('MOVIMENTOS_ESTOQUE', 'antes');
  pulso.registrarEntrada({ custoUnitCentavos: 600, fornecedorId: 'FOR-001', ...ENTRADA });
  assert.equal(pulso.registrarEntrada({ custoUnitCentavos: 600, fornecedorId: 'FOR-001', ...ENTRADA, quantidade: 99 }).erro.codigo, 'REQUISICAO_CONFLITANTE');
  assert.equal(armazenamento.tabelas.MOVIMENTOS_ESTOQUE.length, 0);
});

test('cadastro interrompido não expõe o produto até ser concluído', () => {
  const { pulso, armazenamento } = ambienteComProduto();
  const novo = { requisicaoId: 'REQ-CAD-9', sku: 'MER-009', nome: 'Outro Produto', categoria: 'SNACKS', precoVendaCentavos: 500, custoRefCentavos: 300, estoqueMinimo: 1, estoqueAlvo: 2 };
  armazenamento.falharNaProxima('OPERACOES_LOG', 'antes', confirmacao);
  assert.equal(pulso.cadastrarProduto(novo).ok, false);
  assert.equal(pulso.consultarEstoque({ sku: 'MER-009' }).erro.codigo, 'SKU_INEXISTENTE');
  assert.equal(pulso.cadastrarProduto(novo).recuperada, true);
  assert.equal(pulso.consultarEstoque({ sku: 'MER-009' }).saldoAtual, 0);
  assert.equal(armazenamento.tabelas.PRODUTOS.length, 2);
});

test('falha ao registrar a rejeição não muda a resposta nem o estoque', () => {
  const { pulso, armazenamento } = ambienteComProduto();
  armazenamento.falharNaProxima('OPERACOES_LOG', 'antes', (l) => l.estado === 'REJEITADA');
  assert.equal(pulso.registrarEntrada({ custoUnitCentavos: 600, fornecedorId: 'FOR-001', requisicaoId: 'REQ-R', sku: 'MER-001', quantidade: -1 }).erro.codigo, 'QTD_INVALIDA');
  assert.equal(saldo(pulso), 0);
});

test('lock ocupado devolve erro claro e não grava', () => {
  const { carregarNucleo } = require('../local/nucleo');
  const gravadas = [];
  const pulso = carregarNucleo().criar({
    armazenamento: { ler: () => [], anexar: (t, l) => gravadas.push(l) },
    lock: { executar() { throw Object.assign(new Error('Outra operação em andamento.'), { codigo: 'LOCK_OCUPADO' }); } },
    relogio: () => '2026-11-18T12:00:00.000Z',
    gerarId: (p) => `${p}-1`,
  });
  assert.equal(pulso.registrarEntrada({ custoUnitCentavos: 600, fornecedorId: 'FOR-001', ...ENTRADA }).erro.codigo, 'LOCK_OCUPADO');
  assert.equal(gravadas.length, 0);
});

// Adulteração direta dos dados precisa ser detectada, nunca somada em silêncio.
const ADULTERACOES = [
  ['saldo inflado pela edição do movimento', (t) => { t.MOVIMENTOS_ESTOQUE[0].delta_unidades = 500; }],
  ['movimento apagado', (t) => { t.MOVIMENTOS_ESTOQUE.pop(); }],
  ['movimento copiado', (t) => { t.MOVIMENTOS_ESTOQUE.push({ ...t.MOVIMENTOS_ESTOQUE[0] }); }],
  ['movimento inserido sem operação', (t) => { t.MOVIMENTOS_ESTOQUE.push({ ...t.MOVIMENTOS_ESTOQUE[0], movimento_id: 'MOV-X', operacao_id: 'OPR-X' }); }],
  ['movimento extra em operação existente', (t) => { t.MOVIMENTOS_ESTOQUE.push({ ...t.MOVIMENTOS_ESTOQUE[0], movimento_id: 'MOV-Y' }); }],
  ['quantidade decimal na planilha', (t) => { t.MOVIMENTOS_ESTOQUE[0].delta_unidades = 1.5; }],
  ['coluna removida', (t) => { delete t.MOVIMENTOS_ESTOQUE[0].motivo; }],
  ['produto editado', (t) => { t.PRODUTOS[0].preco_venda_centavos = 1; }],
  ['produto apagado', (t) => { t.PRODUTOS.length = 0; }],
  ['confirmação sem intenção', (t) => { t.OPERACOES_LOG.shift(); }],
  ['payload ilegível', (t) => { t.OPERACOES_LOG.find(intencao).payload = '{'; }],
];

for (const [nome, adulterar] of ADULTERACOES) {
  test(`adulteração detectada: ${nome}`, () => {
    const { pulso, armazenamento } = ambienteComProduto();
    pulso.registrarEntrada({ custoUnitCentavos: 600, fornecedorId: 'FOR-001', ...ENTRADA });
    adulterar(armazenamento.tabelas);
    assert.equal(pulso.consultarEstoque({ sku: 'MER-001' }).erro.codigo, 'DADOS_INCONSISTENTES');
    assert.equal(pulso.registrarEntrada({ custoUnitCentavos: 600, fornecedorId: 'FOR-001', requisicaoId: 'REQ-NOVA', sku: 'MER-001', quantidade: 1 }).erro.codigo, 'DADOS_INCONSISTENTES');
  });
}

test('saldo negativo forjado com operação aparentemente válida é detectado', () => {
  const { pulso, armazenamento } = ambienteComProduto();
  const instante = '2026-11-18T13:00:00.000Z';
  const linha = {
    movimento_id: 'MOV-FORJADO', operacao_id: 'OPR-FORJADA', sku: 'MER-001', tipo: 'PERDA', delta_unidades: -5,
    motivo: null, referencia_id: null, registrado_em: instante, operador_simulado: 'OPERADOR-DEMO',
  };
  const evento = {
    operacao_id: 'OPR-FORJADA', requisicao_id: 'REQ-FORJADA', tipo: 'PERDA', registrado_em: instante, resumo: 'Forjado.',
    referencia_id: 'MOV-FORJADO', erro_cod: null, tentativas: 1,
  };
  armazenamento.tabelas.OPERACOES_LOG.push(
    { ...evento, evento_id: 'EVT-F1', estado: 'PENDENTE', assinatura: '{}', payload: JSON.stringify({ tabela: 'MOVIMENTOS_ESTOQUE', linha }) },
    { ...evento, evento_id: 'EVT-F2', estado: 'CONFIRMADA', assinatura: null, payload: null },
  );
  armazenamento.tabelas.MOVIMENTOS_ESTOQUE.push(linha);
  assert.equal(pulso.consultarEstoque({ sku: 'MER-001' }).erro.codigo, 'DADOS_INCONSISTENTES');
});

test('log preserva a sequência auditável da operação', () => {
  const { pulso, armazenamento } = ambienteComProduto();
  pulso.registrarEntrada({ custoUnitCentavos: 600, fornecedorId: 'FOR-001', ...ENTRADA });
  const estados = armazenamento.tabelas.OPERACOES_LOG.filter((e) => e.requisicao_id === 'REQ-F1').map((e) => e.estado);
  assert.deepEqual(estados, ['PENDENTE', 'CONFIRMADA']);
  assert.equal(eventos(armazenamento, 'REJEITADA').length, 0);
});
