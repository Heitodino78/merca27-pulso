'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { ambienteComProduto, eventos, FORMATOS, editarPayload } = require('./apoio');
const { criarArmazenamentoJsonl } = require('../local/armazenamento-jsonl');

const ENTRADA = { custoUnitCentavos: 600, fornecedorId: 'FOR-001', requisicaoId: 'INTEGRIDADE-1', sku: 'MER-001', quantidade: 10 };
const confirmacaoEntrada = (armazenamento) => eventos(armazenamento, 'CONFIRMADA')
  .filter((evento) => evento.requisicao_id === ENTRADA.requisicaoId);

test('entrada que excede o limite de saldo exato é rejeitada antes de criar intenção', () => {
  const { pulso, armazenamento } = ambienteComProduto();
  assert.equal(pulso.registrarEntrada({ custoUnitCentavos: 600, fornecedorId: 'FOR-001', ...ENTRADA, quantidade: Number.MAX_SAFE_INTEGER }).ok, true);
  const quantidadeEventos = armazenamento.tabelas.OPERACOES_LOG.length;
  const r = pulso.registrarEntrada({ custoUnitCentavos: 600, fornecedorId: 'FOR-001', ...ENTRADA, requisicaoId: 'INTEGRIDADE-2', quantidade: 1 });
  assert.equal(r.ok, false);
  assert.equal(r.erro.codigo, 'QTD_INVALIDA');
  assert.equal(armazenamento.tabelas.MOVIMENTOS_ESTOQUE.length, 1);
  assert.equal(armazenamento.tabelas.OPERACOES_LOG.slice(quantidadeEventos).some((e) => e.estado === 'PENDENTE'), false);
  assert.equal(pulso.consultarEstoque({ sku: 'MER-001' }).saldoAtual, Number.MAX_SAFE_INTEGER);
});

test('histórico importado com soma fora do limite exato é detectado na leitura', () => {
  const { pulso, armazenamento } = ambienteComProduto();
  pulso.registrarEntrada({ custoUnitCentavos: 600, fornecedorId: 'FOR-001', ...ENTRADA, quantidade: 1 });
  pulso.registrarEntrada({ custoUnitCentavos: 600, fornecedorId: 'FOR-001', ...ENTRADA, requisicaoId: 'INTEGRIDADE-2', quantidade: 1 });
  const movimento = armazenamento.tabelas.MOVIMENTOS_ESTOQUE[1];
  movimento.delta_unidades = Number.MAX_SAFE_INTEGER;
  const intencao = eventos(armazenamento, 'PENDENTE').find((e) => e.requisicao_id === 'INTEGRIDADE-2');
  intencao.payload = JSON.stringify({ tabela: 'MOVIMENTOS_ESTOQUE', linha: movimento });
  const dados = JSON.parse(intencao.assinatura);
  dados.quantidade = Number.MAX_SAFE_INTEGER;
  intencao.assinatura = JSON.stringify(dados);
  assert.equal(pulso.consultarEstoque({ sku: 'MER-001' }).erro.codigo, 'DADOS_INCONSISTENTES');
});

for (const reconciliar of [false, true]) {
  test(`registro gravado com conteúdo diferente não é confirmado (${reconciliar ? 'reconciliação' : 'entrada nova'})`, () => {
    const { pulso, armazenamento } = ambienteComProduto();
    if (reconciliar) {
      armazenamento.falharNaProxima('MOVIMENTOS_ESTOQUE', 'antes');
      assert.equal(pulso.registrarEntrada(ENTRADA).ok, false);
    }
    const anexarOriginal = armazenamento.anexar.bind(armazenamento);
    armazenamento.anexar = (tabela, linha) => anexarOriginal(tabela,
      tabela === 'MOVIMENTOS_ESTOQUE' ? { ...linha, delta_unidades: 999 } : linha);
    const r = reconciliar ? pulso.reconciliarPendencias() : pulso.registrarEntrada(ENTRADA);
    assert.equal(r.ok, false);
    assert.equal(confirmacaoEntrada(armazenamento).length, 0);
  });
}

test('reconciliação relê o estado final e não anuncia sucesso após corrupção na confirmação', () => {
  const { pulso, armazenamento } = ambienteComProduto();
  armazenamento.falharNaProxima('MOVIMENTOS_ESTOQUE', 'antes');
  assert.equal(pulso.registrarEntrada(ENTRADA).ok, false);
  const anexarOriginal = armazenamento.anexar.bind(armazenamento);
  armazenamento.anexar = (tabela, linha) => {
    anexarOriginal(tabela, linha);
    if (linha.estado === 'CONFIRMADA') armazenamento.tabelas.MOVIMENTOS_ESTOQUE.pop();
  };
  const r = pulso.reconciliarPendencias();
  assert.equal(r.ok, false);
  assert.equal(r.erro.codigo, 'DADOS_INCONSISTENTES');
});

test('erro de retorno após confirmar reconciliação não promete ausência de gravação e permite repetição', () => {
  const { pulso, armazenamento } = ambienteComProduto();
  armazenamento.falharNaProxima('MOVIMENTOS_ESTOQUE', 'antes');
  pulso.registrarEntrada(ENTRADA);
  armazenamento.falharNaProxima('OPERACOES_LOG', 'depois', (e) => e.estado === 'CONFIRMADA');
  const r = pulso.reconciliarPendencias();
  assert.equal(r.ok, false);
  assert.equal(r.erro.codigo, 'FALHA_GRAVACAO');
  assert.doesNotMatch(r.erro.mensagem, /Nada foi confirmado/i);
  assert.equal(pulso.consultarEstoque({ sku: 'MER-001' }).saldoAtual, 10);
  assert.equal(pulso.reconciliarPendencias().reconciliadas.length, 0);
  assert.equal(armazenamento.tabelas.MOVIMENTOS_ESTOQUE.length, 1);
});

const ALTERACOES_LOG = [
  ['estado desconhecido', (evento) => { evento.estado = 'SUCESSO'; }],
  ['tipo diferente', (evento) => { evento.tipo = 'CADASTRO_PRODUTO'; }],
  ['requisição diferente', (evento) => { evento.requisicao_id = 'OUTRA-REQUISICAO'; }],
  ['referência diferente', (evento) => { evento.referencia_id = 'MOV-OUTRO'; }],
  ['tentativas negativas', (evento) => { evento.tentativas = -1; }],
];
for (const [nome, alterar] of ALTERACOES_LOG) {
  test(`log com ${nome} é recusado na consulta e em novos lançamentos`, () => {
    const { pulso, armazenamento } = ambienteComProduto();
    pulso.registrarEntrada(ENTRADA);
    alterar(confirmacaoEntrada(armazenamento)[0]);
    assert.equal(pulso.consultarEstoque({ sku: 'MER-001' }).erro.codigo, 'DADOS_INCONSISTENTES');
    assert.equal(pulso.registrarEntrada({ custoUnitCentavos: 600, fornecedorId: 'FOR-001', ...ENTRADA, requisicaoId: 'INTEGRIDADE-NOVA' }).erro.codigo, 'DADOS_INCONSISTENTES');
  });
}

for (const formato of FORMATOS) {
  for (const tabela of ['OPERACOES_LOG', '__proto__', 'constructor']) {
    test(`intenção não pode apontar para a tabela ${tabela} (payload ${formato})`, () => {
      const { pulso, armazenamento } = ambienteComProduto();
      pulso.registrarEntrada(ENTRADA);
      const intencao = eventos(armazenamento, 'PENDENTE').find((e) => e.requisicao_id === ENTRADA.requisicaoId);
      editarPayload(intencao, formato, (r) => {
        r.tabela = tabela;
        if (tabela === 'OPERACOES_LOG') r.linha = { ...confirmacaoEntrada(armazenamento)[0] };
      });
      const forma = JSON.parse(intencao.payload);
      assert.deepEqual(Object.keys(forma).sort(), formato === 'legado' ? ['linha', 'tabela'] : ['registros'], 'só a tabela muda, não a forma do payload');
      assert.equal(pulso.listarProdutos().erro.codigo, 'DADOS_INCONSISTENTES');
    });
  }
}

test('intenção com assinatura divergente é detectada antes de uma repetição', () => {
  const { pulso, armazenamento } = ambienteComProduto();
  pulso.registrarEntrada(ENTRADA);
  eventos(armazenamento, 'PENDENTE').find((e) => e.requisicao_id === ENTRADA.requisicaoId).assinatura = '{}';
  assert.equal(pulso.registrarEntrada(ENTRADA).erro.codigo, 'DADOS_INCONSISTENTES');
});

for (const formato of FORMATOS) {
  test(`intenção com número de unidades negativo não pode ser recuperada (payload ${formato})`, () => {
    const { pulso, armazenamento } = ambienteComProduto();
    armazenamento.falharNaProxima('MOVIMENTOS_ESTOQUE', 'antes');
    pulso.registrarEntrada(ENTRADA);
    const intencao = eventos(armazenamento, 'PENDENTE').find((e) => e.requisicao_id === ENTRADA.requisicaoId);
    editarPayload(intencao, formato, (r) => { r.linha.delta_unidades = -1; });
    const r = pulso.reconciliarPendencias();
    assert.equal(r.ok, false);
    assert.equal(r.erro.codigo, 'DADOS_INCONSISTENTES');
    assert.equal(confirmacaoEntrada(armazenamento).length, 0);
  });
}

test('JSONL completa escritas parciais de bytes antes de confirmar a gravação', (t) => {
  const pasta = fs.mkdtempSync(path.join(os.tmpdir(), 'pulso-escrita-parcial-'));
  t.after(() => fs.rmSync(pasta, { recursive: true, force: true }));
  const armazenamento = criarArmazenamentoJsonl(pasta);
  const writeOriginal = fs.writeSync;
  t.mock.method(fs, 'writeSync', (descritor, dados, offset, tamanho) => {
    if (typeof dados === 'string') return writeOriginal(descritor, dados.slice(0, 5));
    return writeOriginal(descritor, dados, offset, Math.min(tamanho, 5));
  });
  const linha = { nome: 'Produto Fictício — água', quantidade: 10 };
  armazenamento.anexar('PRODUTOS', linha);
  assert.deepEqual(armazenamento.ler('PRODUTOS'), [linha]);
});

test('JSONL interrompe com erro quando a escrita não progride', (t) => {
  const pasta = fs.mkdtempSync(path.join(os.tmpdir(), 'pulso-escrita-zero-'));
  t.after(() => fs.rmSync(pasta, { recursive: true, force: true }));
  const armazenamento = criarArmazenamentoJsonl(pasta);
  t.mock.method(fs, 'writeSync', () => 0);
  assert.throws(() => armazenamento.anexar('PRODUTOS', { sku: 'MER-001' }),
    (erro) => erro.codigo === 'FALHA_GRAVACAO');
});
