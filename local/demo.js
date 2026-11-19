'use strict';
/* Demonstração do primeiro marco de qualidade, em pasta temporária descartável. */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { criarPulsoLocal, aplicarCatalogo } = require('./app');

const pasta = fs.mkdtempSync(path.join(os.tmpdir(), 'pulso-demo-'));
try {
  const pulso = criarPulsoLocal(pasta);
  aplicarCatalogo(pulso);
  const saldo = () => pulso.consultarEstoque({ sku: 'MER-001' }).saldoAtual;
  const passo = (titulo, resultado) => {
    const desfecho = resultado.ok ? (resultado.duplicada ? 'ignorada (duplicada)' : 'aceita') : `rejeitada: ${resultado.erro.codigo}`;
    console.log(`${titulo.padEnd(38)} ${desfecho.padEnd(32)} saldo MER-001 = ${saldo()}`);
  };

  console.log('PULSO — demonstração com dados fictícios\n');
  console.log(`${'Estado inicial'.padEnd(38)} ${''.padEnd(32)} saldo MER-001 = ${saldo()}`);
  const entrada = { requisicaoId: 'DEMO-ENTRADA-1', sku: 'MER-001', quantidade: 10 };
  passo('Entrada válida de 10 unidades', pulso.registrarEntrada(entrada));
  passo('Repetição da mesma requisição', pulso.registrarEntrada(entrada));
  passo('Mesma requisição com outra quantidade', pulso.registrarEntrada({ ...entrada, quantidade: 7 }));
  passo('Entrada de -5 unidades', pulso.registrarEntrada({ requisicaoId: 'DEMO-2', sku: 'MER-001', quantidade: -5 }));
  passo('Entrada de 2,5 unidades', pulso.registrarEntrada({ requisicaoId: 'DEMO-3', sku: 'MER-001', quantidade: 2.5 }));
  passo('Entrada em SKU inexistente', pulso.registrarEntrada({ requisicaoId: 'DEMO-4', sku: 'MER-999', quantidade: 1 }));
  console.log(`\nMovimentos confirmados de MER-001: ${pulso.consultarEstoque({ sku: 'MER-001' }).totalMovimentos}`);
} finally {
  fs.rmSync(pasta, { recursive: true, force: true });
}
