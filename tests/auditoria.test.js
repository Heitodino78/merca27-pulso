'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { ambienteComProduto, eventos } = require('./apoio');
const { carregarNucleo } = require('../local/nucleo');
const { criarArmazenamentoJsonl } = require('../local/armazenamento-jsonl');
const ENTRADA = { custoUnitCentavos: 600, fornecedorId: 'FOR-001', requisicaoId: 'AUD-1', sku: 'MER-001', quantidade: 10 };

const ADULTERACOES = [
  ['evento depois da confirmação', (t) => {
    const confirmacao = t.OPERACOES_LOG.find((e) => e.requisicao_id === 'AUD-1' && e.estado === 'CONFIRMADA');
    t.OPERACOES_LOG.push({ ...confirmacao, evento_id: 'EVT-EXTRA', estado: 'PENDENTE_RECONCILIACAO', erro_cod: 'FALHA_GRAVACAO' });
  }],
  ['duas operações com a mesma requisição', (t) => {
    const evento = t.OPERACOES_LOG.find((e) => e.requisicao_id === 'AUD-1' && e.estado === 'PENDENTE');
    const payload = JSON.parse(evento.payload);
    payload.linha.operacao_id = 'OPR-OUTRA';
    payload.linha.movimento_id = 'MOV-OUTRO';
    t.OPERACOES_LOG.push({ ...evento, evento_id: 'EVT-OUTRO', operacao_id: 'OPR-OUTRA', referencia_id: 'MOV-OUTRO', payload: JSON.stringify(payload) });
  }],
  ['movimento de SKU sem cadastro', (t) => {
    const evento = t.OPERACOES_LOG.find((e) => e.requisicao_id === 'AUD-1' && e.estado === 'PENDENTE');
    const payload = JSON.parse(evento.payload);
    payload.linha.sku = 'MER-999';
    const dados = JSON.parse(evento.assinatura);
    dados.sku = 'MER-999';
    evento.payload = JSON.stringify(payload);
    evento.assinatura = JSON.stringify(dados);
    t.MOVIMENTOS_ESTOQUE[0].sku = 'MER-999';
  }],
  ['referência da intenção divergente', (t) => {
    t.OPERACOES_LOG.find((e) => e.requisicao_id === 'AUD-1' && e.estado === 'PENDENTE').referencia_id = 'MOV-OUTRO';
  }],
  ['estado desconhecido com erro válido', (t) => {
    const e = t.OPERACOES_LOG.find((e) => e.requisicao_id === 'AUD-1' && e.estado === 'CONFIRMADA');
    e.estado = 'DESCONHECIDA'; e.erro_cod = 'FALHA_GRAVACAO';
  }],
];
for (const [nome, adulterar] of ADULTERACOES) {
  test(`auditoria rejeita ${nome}`, () => {
    const { pulso, armazenamento } = ambienteComProduto();
    assert.equal(pulso.registrarEntrada(ENTRADA).ok, true);
    adulterar(armazenamento.tabelas);
    assert.equal(pulso.listarProdutos().erro.codigo, 'DADOS_INCONSISTENTES');
  });
}

test('tipo desconhecido em evento REJEITADA não é ignorado', () => {
  const { pulso, armazenamento } = ambienteComProduto();
  pulso.registrarEntrada({ custoUnitCentavos: 600, fornecedorId: 'FOR-001', ...ENTRADA, quantidade: -1 });
  eventos(armazenamento, 'REJEITADA')[0].tipo = 'DESCONHECIDA';
  assert.equal(pulso.listarProdutos().erro.codigo, 'DADOS_INCONSISTENTES');
});

test('tentativas negativas em evento REJEITADA são recusadas', () => {
  const { pulso, armazenamento } = ambienteComProduto();
  pulso.registrarEntrada({ custoUnitCentavos: 600, fornecedorId: 'FOR-001', ...ENTRADA, quantidade: -1 });
  eventos(armazenamento, 'REJEITADA')[0].tentativas = -1;
  assert.equal(pulso.listarProdutos().erro.codigo, 'DADOS_INCONSISTENTES');
});

test('JSONL recusa linha JSON completa sem terminador de registro', (t) => {
  const pasta = fs.mkdtempSync(path.join(os.tmpdir(), 'pulso-sem-terminador-'));
  t.after(() => fs.rmSync(pasta, { recursive: true, force: true }));
  const armazenamento = criarArmazenamentoJsonl(pasta);
  fs.writeFileSync(path.join(pasta, 'PRODUTOS.jsonl'), JSON.stringify({ sku: 'MER-001' }) + ' ');
  assert.throws(() => armazenamento.ler('PRODUTOS'), (erro) => erro.codigo === 'DADOS_INCONSISTENTES');
});

test('JSONL sincroniza o descritor depois de escrever e antes de fechá-lo', (t) => {
  const pasta = fs.mkdtempSync(path.join(os.tmpdir(), 'pulso-fsync-'));
  t.after(() => fs.rmSync(pasta, { recursive: true, force: true }));
  const armazenamento = criarArmazenamentoJsonl(pasta);
  const sincronizados = [];
  const fsyncOriginal = fs.fsyncSync;
  t.mock.method(fs, 'fsyncSync', (fd) => {
    assert.ok(fs.fstatSync(fd).size > 0);
    sincronizados.push(fd);
    fsyncOriginal(fd);
  });
  armazenamento.anexar('PRODUTOS', { sku: 'MER-001' });
  assert.equal(sincronizados.length, 1);
  assert.throws(() => fs.fstatSync(sincronizados[0]), { code: 'EBADF' });
});

test('executor não responde sucesso se a releitura devolve operação pendente', () => {
  const nucleo = carregarNucleo();
  let leituras = 0;
  const estado = () => ({ produtos: new Map(), movimentos: [], pendentes: [], operacoesPorRequisicao: new Map() });
  const ctx = {
    lock: { executar: (fn) => fn() }, relogio: () => '2026-11-18T12:00:00.000Z', gerarId: (p) => p + '-TESTE',
    repositorio: {
      anexarVerificado() {},
      carregarEstado() {
        const e = estado();
        if (++leituras > 1) e.operacoesPorRequisicao.set('AUD-1', { estado: 'PENDENTE' });
        return e;
      },
    },
  };
  const r = nucleo.operacoes.executar(ctx, {
    tipo: 'ENTRADA', normalizar: () => ({ ok: true, dados: {} }), assinatura: (d) => d,
    verificar: () => null, construir: () => ({ tabela: 'MOVIMENTOS_ESTOQUE', linha: { movimento_id: 'MOV-TESTE' } }),
    responder: () => ({ ok: true }),
  }, ENTRADA);
  assert.equal(r.ok, false);
  assert.equal(r.erro.codigo, 'FALHA_GRAVACAO');
});

test('reconciliação não responde sucesso se ainda houver pendência na releitura final', () => {
  const nucleo = carregarNucleo();
  const r = nucleo.operacoes.reconciliar({
    lock: { executar: (fn) => fn() },
    repositorio: { carregarEstado: () => ({ pendentes: [{ requisicaoId: 'AUD-1', tabela: 'PRODUTOS', linha: { sku: 'MER-001' }, tentativas: 1 }] }),
      existe: () => true, anexarVerificado() {} },
    relogio: () => '2026-11-18T12:00:00.000Z', gerarId: (p) => p + '-TESTE',
  });
  assert.equal(r.ok, false);
  assert.equal(r.erro.codigo, 'FALHA_GRAVACAO');
});
