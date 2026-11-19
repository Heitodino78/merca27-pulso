'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { ambienteComProduto, saldoRecalculado } = require('./apoio');
const { criarPulsoLocal, aplicarCatalogo } = require('../local/app');
const INICIAL = { requisicaoId: 'INICIAL-1', sku: 'MER-001', quantidade: 7, custoUnitCentavos: 600, motivo: 'Inventário fictício' };
const PERDA = { requisicaoId: 'PERDA-1', sku: 'MER-001', quantidade: 2, categoriaPerda: 'AVARIA', motivo: 'Avaria fictícia' };
const AJUSTE = { requisicaoId: 'AJUSTE-1', sku: 'MER-001', quantidadeContada: 4, motivo: 'Contagem fictícia' };
const comSaldo = () => {
  const ambiente = ambienteComProduto();
  assert.equal(ambiente.pulso.registrarSaldoInicial(INICIAL).ok, true);
  return ambiente;
};

test('perda de 2 com saldo 7 gera saldo 5 e fica separada de venda', () => {
  const { pulso, armazenamento } = comSaldo();
  assert.equal(pulso.registrarPerda(PERDA).saldoAtual, 5);
  const c = pulso.consultarEstoque({ sku: 'MER-001' });
  assert.equal(c.historico[1].tipo, 'PERDA');
  assert.equal(c.historico[1].deltaUnidades, -2);
  assert.equal(c.historico[1].categoriaPerda, 'AVARIA');
  assert.equal(saldoRecalculado(armazenamento, 'MER-001'), 5);
});

test('perda acima do saldo é rejeitada sem movimento novo', () => {
  const { pulso, armazenamento } = comSaldo();
  assert.equal(pulso.registrarPerda({ ...PERDA, quantidade: 8 }).erro.codigo, 'SALDO_INSUFICIENTE');
  assert.equal(armazenamento.tabelas.MOVIMENTOS_ESTOQUE.length, 1);
  assert.equal(pulso.consultarEstoque({ sku: 'MER-001' }).saldoAtual, 7);
});

for (const [contada, delta] of [[4, -1], [8, 3], [0, -5]]) {
  test(`contagem ${contada} sobre saldo 5 gera ajuste ${delta}`, () => {
    const { pulso } = comSaldo();
    pulso.registrarPerda(PERDA);
    assert.equal(pulso.ajustarPorContagem({ ...AJUSTE, quantidadeContada: contada }).saldoAtual, contada);
    const m = pulso.consultarEstoque({ sku: 'MER-001' }).historico[2];
    assert.equal(m.deltaUnidades, delta);
    assert.equal(m.saldoAnterior, 5);
    assert.equal(m.saldoNovo, contada);
    assert.equal(m.motivo, AJUSTE.motivo);
  });
}

test('contagem igual ao saldo não cria movimento; inicial só ocorre antes de qualquer movimento', () => {
  const { pulso, armazenamento } = comSaldo();
  assert.equal(pulso.ajustarPorContagem({ ...AJUSTE, quantidadeContada: 7 }).erro.codigo, 'AJUSTE_SEM_DIFERENCA');
  assert.equal(pulso.registrarSaldoInicial({ ...INICIAL, requisicaoId: 'INICIAL-2' }).erro.codigo, 'SALDO_INICIAL_INDEVIDO');
  assert.equal(armazenamento.tabelas.MOVIMENTOS_ESTOQUE.length, 1);
  const outro = ambienteComProduto();
  outro.pulso.registrarEntrada({ requisicaoId: 'ENT-1', sku: 'MER-001', quantidade: 1, custoUnitCentavos: 500, fornecedorId: 'FOR-001' });
  assert.equal(outro.pulso.registrarSaldoInicial(INICIAL).erro.codigo, 'SALDO_INICIAL_INDEVIDO');
});

test('produto inativo aceita perda e ajuste, com custo vigente preservado no histórico', () => {
  const { pulso } = comSaldo();
  pulso.desativarProduto({ requisicaoId: 'DES-1', sku: 'MER-001', motivo: 'Pausa fictícia' });
  assert.equal(pulso.registrarPerda(PERDA).saldoAtual, 5);
  pulso.alterarProduto({ requisicaoId: 'CUSTO-ALT', sku: 'MER-001', campos: { custoRefCentavos: 700 }, motivo: 'Novo custo fictício' });
  assert.equal(pulso.ajustarPorContagem(AJUSTE).saldoAtual, 4);
  pulso.alterarProduto({ requisicaoId: 'CUSTO-ALT-2', sku: 'MER-001', campos: { custoRefCentavos: 800 }, motivo: 'Outro custo fictício' });
  const h = pulso.consultarEstoque({ sku: 'MER-001' }).historico;
  assert.equal(h[1].custoUnitCentavos, 600);
  assert.equal(h[2].custoUnitCentavos, 700);
});

for (const [metodo, pedido, preparar] of [
  ['registrarSaldoInicial', INICIAL, ambienteComProduto], ['registrarPerda', PERDA, comSaldo], ['ajustarPorContagem', AJUSTE, comSaldo],
]) {
  test(`${metodo}: repetição e conflito não duplicam histórico`, () => {
    const { pulso, armazenamento } = preparar();
    assert.equal(pulso[metodo](pedido).ok, true);
    const quantidade = armazenamento.tabelas.MOVIMENTOS_ESTOQUE.length;
    assert.equal(pulso[metodo](pedido).duplicada, true);
    assert.equal(pulso[metodo]({ ...pedido, motivo: 'Motivo diferente' }).erro.codigo, 'REQUISICAO_CONFLITANTE');
    assert.equal(armazenamento.tabelas.MOVIMENTOS_ESTOQUE.length, quantidade);
  });
  for (const etapa of ['PENDENTE', 'DADO', 'CONFIRMADA']) for (const modo of ['antes', 'depois', 'silencioso']) {
    test(`${metodo}: falha ${etapa}/${modo} não anuncia sucesso e repetição não duplica`, () => {
      const { pulso, armazenamento } = preparar();
      const quantidade = armazenamento.tabelas.MOVIMENTOS_ESTOQUE.length;
      armazenamento.falharNaProxima(etapa === 'DADO' ? 'MOVIMENTOS_ESTOQUE' : 'OPERACOES_LOG', modo,
        etapa === 'DADO' ? undefined : (e) => e.estado === etapa);
      assert.equal(pulso[metodo](pedido).ok, false);
      assert.equal(pulso[metodo](pedido).ok, true);
      assert.equal(pulso[metodo](pedido).duplicada, true);
      assert.equal(armazenamento.tabelas.MOVIMENTOS_ESTOQUE.length, quantidade + 1);
    });
  }
  for (const valor of [-1, 1.5, NaN, Infinity, '2', null]) {
    test(`${metodo}: rejeita quantidade inválida ${String(valor)}`, () => {
      const { pulso } = preparar();
      const campo = metodo === 'ajustarPorContagem' ? 'quantidadeContada' : 'quantidade';
      assert.equal(pulso[metodo]({ ...pedido, [campo]: valor }).erro.codigo, 'QTD_INVALIDA');
    });
  }
  test(`${metodo}: motivo obrigatório e SKU inexistente`, () => {
    const { pulso } = preparar();
    assert.equal(pulso[metodo]({ ...pedido, motivo: undefined }).erro.codigo, 'DADOS_INVALIDOS');
    assert.equal(pulso[metodo]({ ...pedido, sku: 'MER-999' }).erro.codigo, 'SKU_INEXISTENTE');
  });
}

test('perdas concorrentes em processos reais nunca excedem o saldo disponível', async (t) => {
  const pasta = fs.mkdtempSync(path.join(os.tmpdir(), 'pulso-perdas-'));
  t.after(() => fs.rmSync(pasta, { recursive: true, force: true }));
  const pulso = criarPulsoLocal(pasta);
  aplicarCatalogo(pulso);
  assert.equal(pulso.registrarSaldoInicial(INICIAL).ok, true);
  const app = path.resolve(__dirname, '../local/app.js');
  const respostas = await Promise.all(Array.from({ length: 8 }, (_, i) => new Promise((resolve, reject) => {
    const codigo = `const {criarPulsoLocal}=require(${JSON.stringify(app)}); const r=criarPulsoLocal(process.argv[1]).registrarPerda(JSON.parse(process.argv[2])); console.log(JSON.stringify(r));`;
    const filho = spawn(process.execPath, ['-e', codigo, pasta, JSON.stringify({ ...PERDA, requisicaoId: `CONC-PERDA-${i}` })]);
    let saida = ''; filho.stdout.on('data', (d) => { saida += d; }); filho.on('error', reject);
    filho.on('close', (code) => { try { assert.equal(code, 0); resolve(JSON.parse(saida)); } catch (erro) { reject(erro); } });
  })));
  assert.equal(respostas.filter((r) => r.ok).length, 3);
  assert.ok(respostas.filter((r) => !r.ok).every((r) => r.erro.codigo === 'SALDO_INSUFICIENTE'));
  const consulta = pulso.consultarEstoque({ sku: 'MER-001' });
  assert.equal(consulta.saldoAtual, 1);
  assert.ok(consulta.historico.every((m) => m.saldoApos >= 0));
});
