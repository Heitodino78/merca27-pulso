'use strict';
/* Demonstração do primeiro marco de qualidade, em pasta temporária descartável. */
const fs = require('node:fs');
const assert = require('node:assert/strict');
const os = require('node:os');
const path = require('node:path');
const { criarPulsoLocal, aplicarCatalogo } = require('./app');

const pasta = fs.mkdtempSync(path.join(os.tmpdir(), 'pulso-demo-'));
try {
  const pulso = criarPulsoLocal(pasta);
  assert.ok(aplicarCatalogo(pulso).every((r) => r.ok), 'O catálogo precisa ser gravado antes da demonstração.');
  const consulta = () => {
    const r = pulso.consultarEstoque({ sku: 'MER-001' });
    assert.equal(r.ok, true, 'A consulta precisa concluir sem erro.');
    return r;
  };
  const saldo = () => consulta().saldoAtual;
  const passo = (titulo, resultado, erroEsperado) => {
    assert.equal(resultado.ok, erroEsperado === undefined, titulo);
    if (erroEsperado) assert.equal(resultado.erro.codigo, erroEsperado, titulo);
    assert.equal(saldo(), 10, 'Cada etapa deve preservar o saldo esperado.');
    const desfecho = resultado.ok ? (resultado.duplicada ? 'ignorada (duplicada)' : 'aceita') : `rejeitada: ${resultado.erro.codigo}`;
    console.log(`${titulo.padEnd(38)} ${desfecho.padEnd(32)} saldo MER-001 = ${saldo()}`);
  };

  console.log('PULSO — demonstração com dados fictícios\n');
  assert.equal(saldo(), 0);
  console.log(`${'Estado inicial'.padEnd(38)} ${''.padEnd(32)} saldo MER-001 = ${saldo()}`);
  const entrada = { requisicaoId: 'DEMO-ENTRADA-1', sku: 'MER-001', quantidade: 10 };
  passo('Entrada válida de 10 unidades', pulso.registrarEntrada(entrada));
  const repeticao = pulso.registrarEntrada(entrada);
  assert.equal(repeticao.duplicada, true);
  passo('Repetição da mesma requisição', repeticao);
  passo('Mesma requisição com outra quantidade', pulso.registrarEntrada({ ...entrada, quantidade: 7 }), 'REQUISICAO_CONFLITANTE');
  passo('Entrada de -5 unidades', pulso.registrarEntrada({ requisicaoId: 'DEMO-2', sku: 'MER-001', quantidade: -5 }), 'QTD_INVALIDA');
  passo('Entrada de 2,5 unidades', pulso.registrarEntrada({ requisicaoId: 'DEMO-3', sku: 'MER-001', quantidade: 2.5 }), 'QTD_INVALIDA');
  passo('Entrada em SKU inexistente', pulso.registrarEntrada({ requisicaoId: 'DEMO-4', sku: 'MER-999', quantidade: 1 }), 'SKU_INEXISTENTE');
  const lerTabela = (nome) => fs.readFileSync(path.join(pasta, `${nome}.jsonl`), 'utf8').trim().split('\n').map(JSON.parse);
  const confirmadas = new Set(lerTabela('OPERACOES_LOG').filter((e) => e.estado === 'CONFIRMADA').map((e) => e.operacao_id));
  const movimentos = lerTabela('MOVIMENTOS_ESTOQUE').filter((m) => m.sku === 'MER-001' && confirmadas.has(m.operacao_id));
  const soma = movimentos.reduce((total, m) => total + m.delta_unidades, 0);
  assert.equal(soma, saldo(), 'O recálculo independente deve coincidir com a consulta.');
  assert.equal(movimentos.length, 1);
  assert.equal(consulta().totalMovimentos, 1);
  console.log(`\nRecálculo independente: ${soma} unidades. Movimentos confirmados: ${movimentos.length}.`);
  console.log('Demonstração verificada. Falhas de armazenamento são exercitadas em npm test.');
} finally {
  fs.rmSync(pasta, { recursive: true, force: true });
}
