'use strict';
/* M-03: operações com vários registros, compatibilidade do payload da Fase 01 e CONTAGEM_INVENTARIO. */
const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { criarAmbiente, PRODUTO_BASE, eventos } = require('./apoio');
const { criarPulsoLocal, aplicarCatalogo } = require('../local/app');

const BASE_FASE01 = path.join(__dirname, '..', 'fixtures', 'base-fase01');
const CLI = path.join(__dirname, '..', 'local', 'cli.js');

/** Três produtos com saldos 10, 5 e 0 (MER-001, MER-002, MER-003). */
function ambienteComEstoque() {
  const ambiente = criarAmbiente();
  const { pulso } = ambiente;
  for (const [sku, nome] of [['MER-001', 'Produto Fictício Um'], ['MER-002', 'Produto Fictício Dois'], ['MER-003', 'Produto Fictício Três']]) {
    assert.equal(pulso.cadastrarProduto({ ...PRODUTO_BASE, requisicaoId: `M03-CAD-${sku}`, sku, nome }).ok, true);
  }
  assert.equal(pulso.registrarEntrada({ requisicaoId: 'M03-ENT-1', sku: 'MER-001', quantidade: 10, custoUnitCentavos: 600, fornecedorId: 'FOR-001' }).ok, true);
  assert.equal(pulso.registrarEntrada({ requisicaoId: 'M03-ENT-2', sku: 'MER-002', quantidade: 5, custoUnitCentavos: 600, fornecedorId: 'FOR-001' }).ok, true);
  return ambiente;
}

const CONTAGEM = Object.freeze({
  requisicaoId: 'M03-CONT-1', motivo: 'Inventário fictício',
  itens: [{ sku: 'MER-001', quantidadeContada: 7 }, { sku: 'MER-002', quantidadeContada: 5 }, { sku: 'MER-003', quantidadeContada: 2 }],
});
/** Três diferenças: MER-001 10->8, MER-002 5->6, MER-003 0->1. */
const CONTAGEM_TRES = Object.freeze({
  requisicaoId: 'M03-CONT-3', motivo: 'Inventário fictício',
  itens: [{ sku: 'MER-003', quantidadeContada: 1 }, { sku: 'MER-001', quantidadeContada: 8 }, { sku: 'MER-002', quantidadeContada: 6 }],
});

/** O núcleo roda em outro contexto vm: arrays e objetos dele têm outro protótipo. */
const simples = (valor) => JSON.parse(JSON.stringify(valor));
const saldo = (pulso, sku) => pulso.consultarEstoque({ sku }).saldoAtual;
const intencao = (armazenamento, requisicao) => eventos(armazenamento, 'PENDENTE').find((e) => e.requisicao_id === requisicao);
const movimentosDa = (armazenamento, requisicao) => {
  const operacao = intencao(armazenamento, requisicao)?.operacao_id;
  return armazenamento.tabelas.MOVIMENTOS_ESTOQUE.filter((m) => m.operacao_id === operacao);
};

// ---------------------------------------------------------------- compatibilidade

function copiarBase(t) {
  const pasta = fs.mkdtempSync(path.join(os.tmpdir(), 'pulso-base-fase01-'));
  t.after(() => fs.rmSync(pasta, { recursive: true, force: true }));
  fs.cpSync(BASE_FASE01, pasta, { recursive: true });
  return pasta;
}

test('base gerada pelo código da Fase 01 continua legível, com payload { tabela, linha }', (t) => {
  const pasta = copiarBase(t);
  const log = fs.readFileSync(path.join(pasta, 'OPERACOES_LOG.jsonl'), 'utf8').trim().split('\n').map(JSON.parse);
  const intencoes = log.filter((e) => e.estado === 'PENDENTE');
  assert.ok(intencoes.length >= 9);
  for (const e of intencoes) assert.deepEqual(Object.keys(JSON.parse(e.payload)).sort(), ['linha', 'tabela']);

  const pulso = criarPulsoLocal(pasta);
  const produtos = pulso.listarProdutos();
  assert.equal(produtos.ok, true);
  assert.deepEqual(simples(produtos.produtos.map((p) => [p.sku, p.saldoAtual])), [['MER-001', 7], ['MER-002', 5]]);
  assert.equal(produtos.operacoesPendentes, 1);
  assert.equal(pulso.consultarHistoricoProduto({ sku: 'MER-002' }).versoes.length, 2);
  assert.deepEqual(simples(pulso.consultarEstoque({ sku: 'MER-001' }).historico.map((m) => m.tipo)), ['ENTRADA', 'PERDA', 'AJUSTE']);
});

test('pendência no formato antigo é concluída sem reescrever o log, e novas gravações usam o formato atual', (t) => {
  const pasta = copiarBase(t);
  const original = fs.readFileSync(path.join(pasta, 'OPERACOES_LOG.jsonl'), 'utf8');
  const pulso = criarPulsoLocal(pasta);
  const r = pulso.reconciliarPendencias();
  assert.equal(r.ok, true);
  assert.deepEqual(simples(r.reconciliadas), ['REQ-ENT-PEND']);
  assert.equal(saldo(pulso, 'MER-002'), 9);

  const contagem = pulso.registrarContagem({ requisicaoId: 'M03-COMPAT', motivo: 'Inventário fictício', itens: [{ sku: 'MER-001', quantidadeContada: 6 }] });
  assert.equal(contagem.ok, true);
  const atual = fs.readFileSync(path.join(pasta, 'OPERACOES_LOG.jsonl'), 'utf8');
  assert.ok(atual.startsWith(original), 'linhas antigas preservadas byte a byte');
  const novas = atual.slice(original.length).trim().split('\n').map(JSON.parse).filter((e) => e.estado === 'PENDENTE');
  assert.equal(novas.length, 1);
  assert.deepEqual(Object.keys(JSON.parse(novas[0].payload)), ['registros']);
  assert.equal(criarPulsoLocal(pasta).listarProdutos().ok, true);
});

test('formato antigo não é aceito para tipo novo nem com chaves extras', () => {
  const { pulso, armazenamento } = ambienteComEstoque();
  assert.equal(pulso.registrarContagem(CONTAGEM).ok, true);
  const e = intencao(armazenamento, CONTAGEM.requisicaoId);
  const atual = JSON.parse(e.payload);
  e.payload = JSON.stringify(atual.registros[0]);
  assert.equal(pulso.listarProdutos().erro.codigo, 'DADOS_INCONSISTENTES');
  e.payload = JSON.stringify({ ...atual, extra: 1 });
  assert.equal(pulso.listarProdutos().erro.codigo, 'DADOS_INCONSISTENTES');
  e.payload = JSON.stringify({ registros: [] });
  assert.equal(pulso.listarProdutos().erro.codigo, 'DADOS_INCONSISTENTES');
});

test('contagem de um único registro reescrita no formato antigo é recusada', () => {
  const { pulso, armazenamento } = ambienteComEstoque();
  const r = pulso.registrarContagem({ ...CONTAGEM, requisicaoId: 'M03-CONT-UM', itens: [{ sku: 'MER-001', quantidadeContada: 9 }] });
  assert.equal(r.ok, true);
  const e = intencao(armazenamento, 'M03-CONT-UM');
  const atual = JSON.parse(e.payload);
  assert.equal(atual.registros.length, 1);
  assert.equal(pulso.listarProdutos().ok, true);
  e.payload = JSON.stringify(atual.registros[0]);
  assert.equal(pulso.listarProdutos().erro.codigo, 'DADOS_INCONSISTENTES');
});

test('toda gravação nova usa { registros: [...] }, inclusive as operações de um registro', () => {
  const { pulso, armazenamento } = ambienteComEstoque();
  pulso.registrarPerda({ requisicaoId: 'M03-PER', sku: 'MER-001', quantidade: 1, categoriaPerda: 'AVARIA', motivo: 'Avaria fictícia' });
  pulso.alterarProduto({ requisicaoId: 'M03-ALT', sku: 'MER-002', motivo: 'Revisão fictícia', campos: { estoqueAlvo: 30 } });
  for (const e of eventos(armazenamento, 'PENDENTE')) {
    const payload = JSON.parse(e.payload);
    assert.deepEqual(Object.keys(payload), ['registros'], e.tipo);
    assert.equal(payload.registros.length, 1, e.tipo);
    const chave = { PRODUTOS: 'sku', MOVIMENTOS_ESTOQUE: 'movimento_id', FORNECEDORES: 'fornecedor_id', PRODUTOS_ALTERACOES: 'alteracao_id' }[payload.registros[0].tabela];
    assert.equal(e.referencia_id, payload.registros[0].linha[chave]);
  }
});

// ---------------------------------------------------------------- contagem

test('contagem grava um AJUSTE por SKU com diferença e informa os que já conferiam', () => {
  const { pulso, armazenamento } = ambienteComEstoque();
  const r = pulso.registrarContagem(CONTAGEM);
  assert.equal(r.ok, true);
  assert.deepEqual(simples(r.ajustados.map((a) => [a.sku, a.saldoAnterior, a.saldoNovo, a.deltaUnidades])), [['MER-001', 10, 7, -3], ['MER-003', 0, 2, 2]]);
  assert.deepEqual(simples(r.semDiferenca), ['MER-002']);
  assert.deepEqual([saldo(pulso, 'MER-001'), saldo(pulso, 'MER-002'), saldo(pulso, 'MER-003')], [7, 5, 2]);

  const movimentos = movimentosDa(armazenamento, CONTAGEM.requisicaoId);
  const operacao = intencao(armazenamento, CONTAGEM.requisicaoId).operacao_id;
  assert.deepEqual(movimentos.map((m) => m.movimento_id), [`MOV-${operacao}-1`, `MOV-${operacao}-2`]);
  assert.ok(movimentos.every((m) => m.tipo === 'AJUSTE' && m.custo_unit_centavos === PRODUTO_BASE.custoRefCentavos && m.motivo === 'Inventário fictício'));
  const log = armazenamento.tabelas.OPERACOES_LOG.filter((e) => e.operacao_id === operacao);
  assert.deepEqual(log.map((e) => e.estado), ['PENDENTE', 'CONFIRMADA']);
  assert.ok(log.every((e) => e.referencia_id === `MOV-${operacao}-1`));
  assert.equal(pulso.consultarEstoque({ sku: 'MER-003' }).historico[0].saldoNovo, 2);
});

test('contagem aceita produto inativo, como o ajuste individual', () => {
  const { pulso } = ambienteComEstoque();
  assert.equal(pulso.desativarProduto({ requisicaoId: 'M03-DES', sku: 'MER-001', motivo: 'Pausa fictícia' }).ok, true);
  const r = pulso.registrarContagem({ ...CONTAGEM, requisicaoId: 'M03-CONT-INATIVO' });
  assert.equal(r.ok, true);
  assert.equal(saldo(pulso, 'MER-001'), 7);
});

const RECUSAS = [
  ['SKU inexistente', { itens: [{ sku: 'MER-001', quantidadeContada: 1 }, { sku: 'MER-999', quantidadeContada: 1 }] }, 'SKU_INEXISTENTE'],
  ['SKU repetido', { itens: [{ sku: 'MER-001', quantidadeContada: 1 }, { sku: 'MER-001', quantidadeContada: 2 }] }, 'DADOS_INVALIDOS'],
  ['SKU inválido', { itens: [{ sku: 'mer-1', quantidadeContada: 1 }] }, 'SKU_INVALIDO'],
  ['quantidade negativa', { itens: [{ sku: 'MER-001', quantidadeContada: -1 }] }, 'QTD_INVALIDA'],
  ['quantidade decimal', { itens: [{ sku: 'MER-001', quantidadeContada: 1.5 }] }, 'QTD_INVALIDA'],
  ['quantidade em texto', { itens: [{ sku: 'MER-001', quantidadeContada: '3' }] }, 'QTD_INVALIDA'],
  ['quantidade NaN', { itens: [{ sku: 'MER-001', quantidadeContada: NaN }] }, 'QTD_INVALIDA'],
  ['quantidade ausente', { itens: [{ sku: 'MER-001' }] }, 'QTD_INVALIDA'],
  ['nenhuma diferença', { itens: [{ sku: 'MER-001', quantidadeContada: 10 }, { sku: 'MER-003', quantidadeContada: 0 }] }, 'AJUSTE_SEM_DIFERENCA'],
  ['lista vazia', { itens: [] }, 'DADOS_INVALIDOS'],
  ['itens não é lista', { itens: { sku: 'MER-001', quantidadeContada: 1 } }, 'DADOS_INVALIDOS'],
  ['mais de 100 itens', { itens: Array.from({ length: 101 }, (_, i) => ({ sku: `MER-${String(i + 1).padStart(3, '0')}`, quantidadeContada: 1 })) }, 'DADOS_INVALIDOS'],
  ['campo extra no item', { itens: [{ sku: 'MER-001', quantidadeContada: 1, saldo: 9 }] }, 'DADOS_INVALIDOS'],
  ['campo extra no pedido', { itens: [{ sku: 'MER-001', quantidadeContada: 1 }], saldo: 9 }, 'DADOS_INVALIDOS'],
  ['motivo ausente', { itens: [{ sku: 'MER-001', quantidadeContada: 1 }], motivo: undefined }, 'DADOS_INVALIDOS'],
  ['motivo que parece fórmula', { itens: [{ sku: 'MER-001', quantidadeContada: 1 }], motivo: '=SOMA(A1)' }, 'DADOS_INVALIDOS'],
];
for (const [nome, alteracao, codigo] of RECUSAS) {
  test(`contagem recusada por inteiro: ${nome}`, () => {
    const { pulso, armazenamento } = ambienteComEstoque();
    const antes = { movimentos: armazenamento.tabelas.MOVIMENTOS_ESTOQUE.length, pendentes: eventos(armazenamento, 'PENDENTE').length };
    const r = pulso.registrarContagem({ ...CONTAGEM, ...alteracao });
    assert.equal(r.ok, false);
    assert.equal(r.erro.codigo, codigo);
    assert.equal(armazenamento.tabelas.MOVIMENTOS_ESTOQUE.length, antes.movimentos);
    assert.equal(eventos(armazenamento, 'PENDENTE').length, antes.pendentes);
    assert.deepEqual([saldo(pulso, 'MER-001'), saldo(pulso, 'MER-002'), saldo(pulso, 'MER-003')], [10, 5, 0]);
  });
}

test('contagem repetida, mesmo em outra ordem, é duplicata; dados diferentes com a mesma chave são conflito', () => {
  const { pulso, armazenamento } = ambienteComEstoque();
  assert.equal(pulso.registrarContagem(CONTAGEM).ok, true);
  const repetida = pulso.registrarContagem({ ...CONTAGEM, itens: [...CONTAGEM.itens].reverse() });
  assert.equal(repetida.aviso, 'OPERACAO_DUPLICADA');
  assert.equal(repetida.duplicada, true);
  assert.deepEqual(simples(repetida.semDiferenca), ['MER-002']);
  const conflito = pulso.registrarContagem({ ...CONTAGEM, itens: [{ sku: 'MER-001', quantidadeContada: 1 }] });
  assert.equal(conflito.erro.codigo, 'REQUISICAO_CONFLITANTE');
  assert.equal(movimentosDa(armazenamento, CONTAGEM.requisicaoId).length, 2);
  assert.equal(saldo(pulso, 'MER-001'), 7);
});

// ---------------------------------------------------------------- falhas em cada posição

for (const posicao of [1, 2, 3]) {
  for (const modo of ['antes', 'depois', 'silencioso']) {
    test(`falha ${modo} no registro ${posicao} de 3: não anuncia sucesso e a repetição conclui sem duplicar`, () => {
      const { pulso, armazenamento } = ambienteComEstoque();
      armazenamento.falharNaProxima('MOVIMENTOS_ESTOQUE', modo, (l) => l.movimento_id.endsWith(`-${posicao}`) && l.tipo === 'AJUSTE');
      const r = pulso.registrarContagem(CONTAGEM_TRES);
      assert.equal(r.ok, false);
      assert.equal(r.erro.codigo, 'FALHA_GRAVACAO');
      // Registros de operação incompleta não entram no saldo.
      assert.deepEqual([saldo(pulso, 'MER-001'), saldo(pulso, 'MER-002'), saldo(pulso, 'MER-003')], [10, 5, 0]);
      assert.equal(pulso.listarProdutos().operacoesPendentes, 1);
      assert.equal(pulso.consultarReposicao().operacoesPendentes, 1);

      const repeticao = pulso.registrarContagem(CONTAGEM_TRES);
      assert.equal(repeticao.ok, true);
      assert.equal(repeticao.recuperada, true);
      assert.equal(movimentosDa(armazenamento, CONTAGEM_TRES.requisicaoId).length, 3);
      assert.deepEqual([saldo(pulso, 'MER-001'), saldo(pulso, 'MER-002'), saldo(pulso, 'MER-003')], [8, 6, 1]);
      assert.equal(pulso.registrarContagem(CONTAGEM_TRES).aviso, 'OPERACAO_DUPLICADA');
      assert.equal(movimentosDa(armazenamento, CONTAGEM_TRES.requisicaoId).length, 3);
    });
  }
}

test('falha ao gravar a confirmação: registros completos ficam fora do saldo até a reconciliação', () => {
  const { pulso, armazenamento } = ambienteComEstoque();
  armazenamento.falharNaProxima('OPERACOES_LOG', 'antes', (e) => e.estado === 'CONFIRMADA' && e.tipo === 'CONTAGEM_INVENTARIO');
  assert.equal(pulso.registrarContagem(CONTAGEM_TRES).ok, false);
  assert.equal(movimentosDa(armazenamento, CONTAGEM_TRES.requisicaoId).length, 3);
  assert.equal(saldo(pulso, 'MER-001'), 10);
  const r = pulso.reconciliarPendencias();
  assert.deepEqual(simples(r.reconciliadas), [CONTAGEM_TRES.requisicaoId]);
  assert.equal(movimentosDa(armazenamento, CONTAGEM_TRES.requisicaoId).length, 3);
  assert.equal(saldo(pulso, 'MER-001'), 8);
});

test('reconciliação automática conclui a contagem interrompida antes de um novo lançamento', () => {
  const { pulso, armazenamento } = ambienteComEstoque();
  armazenamento.falharNaProxima('MOVIMENTOS_ESTOQUE', 'antes', (l) => l.movimento_id.endsWith('-2'));
  assert.equal(pulso.registrarContagem(CONTAGEM_TRES).ok, false);
  const entrada = pulso.registrarEntrada({ requisicaoId: 'M03-ENT-NOVA', sku: 'MER-003', quantidade: 4, custoUnitCentavos: 600, fornecedorId: 'FOR-001' });
  assert.equal(entrada.ok, true);
  assert.equal(entrada.saldoAtual, 5, 'contagem (1) concluída antes da entrada (+4)');
  assert.equal(movimentosDa(armazenamento, CONTAGEM_TRES.requisicaoId).length, 3);
  const confirmacao = armazenamento.tabelas.OPERACOES_LOG.find((e) => e.requisicao_id === CONTAGEM_TRES.requisicaoId && e.estado === 'CONFIRMADA');
  assert.match(confirmacao.resumo, /reconciliação automática/);
});

test('a contagem lê o saldo dentro da trava: diferença calculada sobre o estado atual', () => {
  const { pulso } = ambienteComEstoque();
  assert.equal(pulso.registrarPerda({ requisicaoId: 'M03-PER-1', sku: 'MER-001', quantidade: 2, categoriaPerda: 'QUEBRA', motivo: 'Quebra fictícia' }).ok, true);
  const r = pulso.registrarContagem({ ...CONTAGEM, requisicaoId: 'M03-CONT-DEPOIS' });
  assert.deepEqual(simples(r.ajustados.find((a) => a.sku === 'MER-001')), { sku: 'MER-001', movimentoId: r.ajustados[0].movimentoId, saldoAnterior: 8, saldoNovo: 7, deltaUnidades: -1 });
});

// ---------------------------------------------------------------- adulteração

function contagemConfirmada() {
  const ambiente = ambienteComEstoque();
  assert.equal(ambiente.pulso.registrarContagem(CONTAGEM_TRES).ok, true);
  const e = intencao(ambiente.armazenamento, CONTAGEM_TRES.requisicaoId);
  return { ...ambiente, evento: e, operacao: e.operacao_id };
}

const ADULTERACOES = [
  ['registro removido da tabela', ({ armazenamento, operacao }) => {
    const t = armazenamento.tabelas.MOVIMENTOS_ESTOQUE;
    t.splice(t.findIndex((m) => m.movimento_id === `MOV-${operacao}-2`), 1);
  }],
  ['registro extra da mesma operação', ({ armazenamento, operacao }) => {
    const original = armazenamento.tabelas.MOVIMENTOS_ESTOQUE.find((m) => m.movimento_id === `MOV-${operacao}-1`);
    armazenamento.tabelas.MOVIMENTOS_ESTOQUE.push({ ...original, movimento_id: `MOV-${operacao}-4` });
  }],
  ['registro alterado na tabela', ({ armazenamento, operacao }) => {
    armazenamento.tabelas.MOVIMENTOS_ESTOQUE.find((m) => m.movimento_id === `MOV-${operacao}-3`).saldo_novo = 99;
  }],
  ['registro trocado de operação', ({ armazenamento, operacao }) => {
    armazenamento.tabelas.MOVIMENTOS_ESTOQUE.find((m) => m.movimento_id === `MOV-${operacao}-2`).operacao_id = 'OPR-OUTRA';
  }],
  ['ordem dos registros invertida no payload', ({ evento }) => {
    const p = JSON.parse(evento.payload);
    p.registros.reverse();
    evento.payload = JSON.stringify(p);
  }],
  ['registro removido do payload e da tabela, deixando um SKU com diferença sem ajuste', ({ armazenamento, evento, operacao }) => {
    const p = JSON.parse(evento.payload);
    p.registros.pop();
    evento.payload = JSON.stringify(p);
    const t = armazenamento.tabelas.MOVIMENTOS_ESTOQUE;
    t.splice(t.findIndex((m) => m.movimento_id === `MOV-${operacao}-3`), 1);
  }],
  ['registro repetido no payload', ({ evento }) => {
    const p = JSON.parse(evento.payload);
    p.registros.push(p.registros[0]);
    evento.payload = JSON.stringify(p);
  }],
  ['registro de outra tabela no payload', ({ evento }) => {
    const p = JSON.parse(evento.payload);
    p.registros[1] = { tabela: 'PRODUTOS_ALTERACOES', linha: p.registros[1].linha };
    evento.payload = JSON.stringify(p);
  }],
  ['delta forjado no payload e na tabela', ({ armazenamento, evento, operacao }) => {
    const p = JSON.parse(evento.payload);
    p.registros[0].linha.delta_unidades += 1;
    evento.payload = JSON.stringify(p);
    armazenamento.tabelas.MOVIMENTOS_ESTOQUE.find((m) => m.movimento_id === `MOV-${operacao}-1`).delta_unidades += 1;
  }],
  ['quantidade contada forjada na assinatura', ({ evento }) => {
    const a = JSON.parse(evento.assinatura);
    a.itens[0].quantidadeContada += 1;
    evento.assinatura = JSON.stringify(a);
  }],
  ['referência só da intenção diferente do primeiro registro', ({ evento, operacao }) => {
    evento.referencia_id = `MOV-${operacao}-2`;
  }],
  ['referência diferente do primeiro registro', ({ armazenamento, operacao }) => {
    for (const e of armazenamento.tabelas.OPERACOES_LOG.filter((x) => x.operacao_id === operacao)) e.referencia_id = `MOV-${operacao}-2`;
  }],
  ['tipo de um registro trocado para PERDA', ({ armazenamento, evento, operacao }) => {
    const p = JSON.parse(evento.payload);
    p.registros[0].linha.tipo = 'PERDA';
    evento.payload = JSON.stringify(p);
    armazenamento.tabelas.MOVIMENTOS_ESTOQUE.find((m) => m.movimento_id === `MOV-${operacao}-1`).tipo = 'PERDA';
  }],
];
for (const [nome, adulterar] of ADULTERACOES) {
  test(`contagem adulterada detectada: ${nome}`, () => {
    const ambiente = contagemConfirmada();
    adulterar(ambiente);
    assert.equal(ambiente.pulso.listarProdutos().erro.codigo, 'DADOS_INCONSISTENTES');
    const nova = ambiente.pulso.registrarEntrada({ requisicaoId: 'M03-DEPOIS', sku: 'MER-001', quantidade: 1, custoUnitCentavos: 600, fornecedorId: 'FOR-001' });
    assert.equal(nova.erro.codigo, 'DADOS_INCONSISTENTES');
  });
}

test('operação de um registro com dois registros no payload é recusada', () => {
  const { pulso, armazenamento } = ambienteComEstoque();
  const e = intencao(armazenamento, 'M03-ENT-1');
  const p = JSON.parse(e.payload);
  const segundo = { ...p.registros[0].linha, movimento_id: `${p.registros[0].linha.movimento_id}-B` };
  p.registros.push({ tabela: 'MOVIMENTOS_ESTOQUE', linha: segundo });
  e.payload = JSON.stringify(p);
  armazenamento.tabelas.MOVIMENTOS_ESTOQUE.push(segundo);
  assert.equal(pulso.listarProdutos().erro.codigo, 'DADOS_INCONSISTENTES');
});

// ---------------------------------------------------------------- concorrência real

function cliAssincrona(pasta, ...args) {
  return new Promise((resolver) => {
    const filho = spawn(process.execPath, [CLI, ...args], { env: { ...process.env, PULSO_DADOS: pasta }, stdio: 'ignore' });
    filho.on('close', resolver);
  });
}

test('concorrência real: contagens e entradas em processos paralelos ficam coerentes', async (t) => {
  const pasta = fs.mkdtempSync(path.join(os.tmpdir(), 'pulso-m03-concorrencia-'));
  t.after(() => fs.rmSync(pasta, { recursive: true, force: true }));
  aplicarCatalogo(criarPulsoLocal(pasta));
  const tarefas = [];
  for (let i = 0; i < 4; i++) {
    tarefas.push(cliAssincrona(pasta, 'contagem', '--item', `MER-001=${i + 1}`, '--item', `MER-002=${i + 3}`, '--motivo', 'Inventário fictício', '--requisicao', `CONC-CONT-${i}`));
    tarefas.push(cliAssincrona(pasta, 'entrada', '--sku', 'MER-001', '--quantidade', '5', '--custo', '160', '--fornecedor', 'FOR-001', '--requisicao', `CONC-ENT-${i}`));
  }
  // A mesma contagem disparada por vários processos grava uma única vez.
  for (let i = 0; i < 4; i++) tarefas.push(cliAssincrona(pasta, 'contagem', '--item', 'MER-003=9', '--motivo', 'Inventário fictício', '--requisicao', 'CONC-MESMA'));
  const codigos = await Promise.all(tarefas);
  assert.ok(codigos.every((c) => c === 0 || c === 1), JSON.stringify(codigos));

  const pulso = criarPulsoLocal(pasta);
  assert.equal(pulso.listarProdutos().operacoesPendentes, 0);
  const movimentos = fs.readFileSync(path.join(pasta, 'MOVIMENTOS_ESTOQUE.jsonl'), 'utf8').trim().split('\n').map(JSON.parse);
  for (const sku of ['MER-001', 'MER-002', 'MER-003']) {
    const recalculado = movimentos.filter((m) => m.sku === sku).reduce((s, m) => s + m.delta_unidades, 0);
    assert.equal(saldo(pulso, sku), recalculado, sku);
    // Cada AJUSTE parte exatamente do saldo anterior reproduzido.
    let corrente = 0;
    for (const m of movimentos.filter((x) => x.sku === sku)) {
      if (m.tipo === 'AJUSTE') assert.equal(m.saldo_anterior, corrente);
      corrente += m.delta_unidades;
    }
  }
  assert.equal(movimentos.filter((m) => m.sku === 'MER-003').length, 1);
  assert.equal(saldo(pulso, 'MER-003'), 9);
  assert.equal(movimentos.filter((m) => m.tipo === 'ENTRADA').length, 4);
});
