'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { ambienteComProduto } = require('./apoio');
const { carregarNucleo } = require('../local/nucleo');
const { criarPulsoLocal, aplicarCatalogo } = require('../local/app');

test('consulta consistente dispensa trava de escrita', () => {
  const { armazenamento } = ambienteComProduto();
  const pulso = carregarNucleo().criar({ armazenamento,
    lock: { executar() { throw new Error('A consulta não deve aguardar uma gravação.'); } },
    gerarId: () => 'NAO-UTILIZADO', relogio: () => '2026-11-18T12:00:00.000Z' });
  assert.equal(pulso.consultarEstoque({ sku: 'MER-001' }).ok, true);
  assert.equal(pulso.listarProdutos().ok, true);
  assert.equal(pulso.listarFornecedores().ok, true);
  assert.equal(pulso.consultarReposicao().ok, true);
  assert.equal(pulso.consultarHistoricoProduto({ sku: 'MER-001' }).ok, true);
});

for (const transitoria of [true, false]) {
  test(`inconsistência ${transitoria ? 'transitória é resolvida' : 'real continua detectada'} na única repetição com trava`, () => {
    const { armazenamento } = ambienteComProduto();
    let dentro = false;
    let travas = 0;
    let leiturasFora = 0;
    const pulso = carregarNucleo().criar({
      armazenamento: { anexar: armazenamento.anexar.bind(armazenamento), ler(tabela) {
        if (!dentro) leiturasFora++;
        if (tabela === 'OPERACOES_LOG' && (!dentro || !transitoria)) return [];
        return armazenamento.ler(tabela);
      } },
      lock: { executar(fn) { travas++; dentro = true; try { return fn(); } finally { dentro = false; } } },
      gerarId: () => 'NAO-UTILIZADO', relogio: () => '2026-11-18T12:00:00.000Z',
    });
    const r = pulso.consultarEstoque({ sku: 'MER-001' });
    assert.ok(leiturasFora > 0);
    assert.equal(travas, 1);
    assert.equal(r.ok, transitoria);
    if (!transitoria) assert.equal(r.erro.codigo, 'DADOS_INCONSISTENTES');
  });
}

test('processos leitores simultâneos à escrita parcial não reportam falsa inconsistência', async (t) => {
  const pasta = fs.mkdtempSync(path.join(os.tmpdir(), 'pulso-leitores-'));
  t.after(() => fs.rmSync(pasta, { recursive: true, force: true }));
  aplicarCatalogo(criarPulsoLocal(pasta));
  const app = JSON.stringify(path.resolve(__dirname, '../local/app.js'));
  const nucleo = JSON.stringify(path.resolve(__dirname, '../local/nucleo.js'));
  const adaptadores = JSON.stringify(path.resolve(__dirname, '../local/armazenamento-jsonl.js'));
  const escritor = `const {carregarNucleo}=require(${nucleo}); const {criarArmazenamentoJsonl,criarLockArquivo}=require(${adaptadores});
    const p=process.argv[1]; const base=criarArmazenamentoJsonl(p); let id=0;
    const pulso=carregarNucleo().criar({armazenamento:{ler:base.ler,anexar(t,l){base.anexar(t,l);if(t==='MOVIMENTOS_ESTOQUE') Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,15);}},
    lock:criarLockArquivo(require('node:path').join(p,'.pulso.lock')),relogio:()=>new Date().toISOString(),gerarId:(p)=>p+'-CONC-'+(++id)});
    for(let i=0;i<20;i++){const r=pulso.registrarEntrada({requisicaoId:'LEITURA-'+i,sku:'MER-001',quantidade:1,custoUnitCentavos:160,fornecedorId:'FOR-001'});if(!r.ok)throw new Error(JSON.stringify(r));}`;
  const leitor = `const {criarPulsoLocal}=require(${app});const p=criarPulsoLocal(process.argv[1]);let anterior=0;
    for(let i=0;i<30;i++){const r=p.consultarEstoque({sku:'MER-001'});if(!r.ok||r.saldoAtual<anterior||r.saldoAtual>20)throw new Error(JSON.stringify(r));anterior=r.saldoAtual;}`;
  const iniciar = (codigo) => new Promise((resolve, reject) => {
    const filho = spawn(process.execPath, ['-e', codigo, pasta]);
    let erro = ''; filho.stderr.on('data', (d) => { erro += d; }); filho.on('error', reject);
    filho.on('close', (code) => { if (code === 0) resolve(code); else reject(new Error(erro)); });
  });
  await Promise.all([iniciar(escritor), iniciar(leitor), iniciar(leitor), iniciar(leitor), iniciar(leitor)]);
  assert.equal(criarPulsoLocal(pasta).consultarEstoque({ sku: 'MER-001' }).saldoAtual, 20);
});
