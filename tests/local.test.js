'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn, spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { carregarNucleo, listarFontes } = require('../local/nucleo');
const { criarPulsoLocal, aplicarCatalogo, CAMINHO_CATALOGO } = require('../local/app');
const { criarLockArquivo } = require('../local/armazenamento-jsonl');
const { gerarCatalogo, serializar } = require('../local/gerar-fixtures');

const CLI = path.join(__dirname, '..', 'local', 'cli.js');

function pastaTemporaria(t) {
  const pasta = fs.mkdtempSync(path.join(os.tmpdir(), 'pulso-teste-'));
  t.after(() => fs.rmSync(pasta, { recursive: true, force: true }));
  return pasta;
}

const cli = (pasta, ...args) => spawnSync(process.execPath, [CLI, ...args], {
  encoding: 'utf8', env: { ...process.env, PULSO_DADOS: pasta },
});

function cliAssincrona(pasta, ...args) {
  return new Promise((resolver) => {
    const filho = spawn(process.execPath, [CLI, ...args], { env: { ...process.env, PULSO_DADOS: pasta }, stdio: 'ignore' });
    filho.on('close', resolver);
  });
}

const lerJsonl = (pasta, tabela) => fs.readFileSync(path.join(pasta, `${tabela}.jsonl`), 'utf8').trim().split('\n').map(JSON.parse);

test('núcleo roda sem APIs do Node e em qualquer ordem de carga, como no Apps Script', () => {
  for (const inverterOrdem of [false, true]) {
    const nucleo = carregarNucleo({ inverterOrdem });
    assert.equal(typeof nucleo.criar, 'function');
  }
  for (const arquivo of listarFontes()) {
    const codigo = fs.readFileSync(arquivo, 'utf8');
    assert.doesNotMatch(codigo, /\brequire\(|\bprocess\.|\bmodule\.exports|^\s*import\s/m, arquivo);
  }
});

test('catálogo: gerador determinístico e arquivo versionado idêntico', () => {
  assert.equal(serializar(gerarCatalogo()), serializar(gerarCatalogo()));
  assert.equal(fs.readFileSync(CAMINHO_CATALOGO, 'utf8'), serializar(gerarCatalogo()));
  assert.notEqual(serializar(gerarCatalogo(1)), serializar(gerarCatalogo(2)));
});

test('catálogo: seis produtos válidos, um por categoria, sem campos de dados pessoais', (t) => {
  const pulso = criarPulsoLocal(pastaTemporaria(t));
  const resultados = aplicarCatalogo(pulso);
  assert.equal(resultados.length, 6);
  assert.ok(resultados.every((r) => r.ok && !r.duplicada));
  const { produtos } = pulso.listarProdutos();
  assert.deepEqual(Array.from(produtos, (p) => p.sku), ['MER-001', 'MER-002', 'MER-003', 'MER-004', 'MER-005', 'MER-006']);
  assert.equal(new Set(Array.from(produtos, (p) => p.categoria)).size, 6);
  assert.doesNotMatch(fs.readFileSync(CAMINHO_CATALOGO, 'utf8'), /cpf|cnpj|telefone|e-?mail|endere[cç]o|barras/i);
});

test('catálogo: reaplicar não duplica', (t) => {
  const pasta = pastaTemporaria(t);
  aplicarCatalogo(criarPulsoLocal(pasta));
  const resultados = aplicarCatalogo(criarPulsoLocal(pasta));
  assert.ok(resultados.every((r) => r.ok && r.duplicada));
  assert.equal(lerJsonl(pasta, 'PRODUTOS').length, 6);
});

test('persistência: o saldo sobrevive à reabertura e é igual à soma dos arquivos', (t) => {
  const pasta = pastaTemporaria(t);
  const primeira = criarPulsoLocal(pasta);
  aplicarCatalogo(primeira);
  primeira.registrarEntrada({ requisicaoId: 'P-1', sku: 'MER-001', quantidade: 10 });
  const segunda = criarPulsoLocal(pasta);
  assert.equal(segunda.registrarEntrada({ requisicaoId: 'P-1', sku: 'MER-001', quantidade: 10 }).duplicada, true);
  segunda.registrarEntrada({ requisicaoId: 'P-2', sku: 'MER-001', quantidade: 3 });
  const soma = lerJsonl(pasta, 'MOVIMENTOS_ESTOQUE').reduce((total, m) => total + m.delta_unidades, 0);
  assert.equal(segunda.consultarEstoque({ sku: 'MER-001' }).saldoAtual, 13);
  assert.equal(soma, 13);
});

test('persistência: arquivo com linha cortada é detectado, sem confirmar nada', (t) => {
  const pasta = pastaTemporaria(t);
  const pulso = criarPulsoLocal(pasta);
  aplicarCatalogo(pulso);
  fs.appendFileSync(path.join(pasta, 'MOVIMENTOS_ESTOQUE.jsonl'), '{"movimento_id":"cortado');
  assert.equal(pulso.consultarEstoque({ sku: 'MER-001' }).erro.codigo, 'DADOS_INCONSISTENTES');
  assert.equal(pulso.registrarEntrada({ requisicaoId: 'C-1', sku: 'MER-001', quantidade: 1 }).ok, false);
});

test('lock: trava ocupada gera LOCK_OCUPADO e é liberada mesmo após erro', (t) => {
  const pasta = pastaTemporaria(t);
  const caminho = path.join(pasta, 'teste.lock');
  const lock = criarLockArquivo(caminho, { limiteMs: 30, intervaloMs: 5 });
  assert.throws(() => lock.executar(() => lock.executar(() => 1)), (e) => e.codigo === 'LOCK_OCUPADO');
  assert.throws(() => lock.executar(() => { throw new Error('x'); }), /x/);
  assert.equal(fs.existsSync(caminho), false);
  assert.equal(lock.executar(() => 42), 42);
});

test('concorrência real: processos com a mesma requisição geram um único movimento', async (t) => {
  const pasta = pastaTemporaria(t);
  aplicarCatalogo(criarPulsoLocal(pasta));
  const codigos = await Promise.all(Array.from({ length: 8 }, () =>
    cliAssincrona(pasta, 'entrada', '--sku', 'MER-001', '--quantidade', '10', '--requisicao', 'CONC-MESMA')));
  assert.deepEqual(codigos, Array(8).fill(0));
  assert.equal(lerJsonl(pasta, 'MOVIMENTOS_ESTOQUE').length, 1);
  assert.equal(criarPulsoLocal(pasta).consultarEstoque({ sku: 'MER-001' }).saldoAtual, 10);
});

test('concorrência real: processos com requisições distintas somam sem perda', async (t) => {
  const pasta = pastaTemporaria(t);
  aplicarCatalogo(criarPulsoLocal(pasta));
  const codigos = await Promise.all(Array.from({ length: 8 }, (_, i) =>
    cliAssincrona(pasta, 'entrada', '--sku', 'MER-002', '--quantidade', '3', '--requisicao', `CONC-${i}`)));
  assert.deepEqual(codigos, Array(8).fill(0));
  assert.equal(lerJsonl(pasta, 'MOVIMENTOS_ESTOQUE').length, 8);
  assert.equal(criarPulsoLocal(pasta).consultarEstoque({ sku: 'MER-002' }).saldoAtual, 24);
});

test('CLI: jornada cadastro, entrada e saldo de ponta a ponta', (t) => {
  const pasta = pastaTemporaria(t);
  const cadastro = cli(pasta, 'cadastrar', '--sku', 'MER-007', '--nome', 'Produto de Teste', '--categoria', 'MERCEARIA',
    '--preco', '990', '--custo', '600', '--minimo', '5', '--alvo', '12');
  assert.equal(cadastro.status, 0, cadastro.stderr);

  const entrada = cli(pasta, 'entrada', '--sku', 'MER-007', '--quantidade', '10', '--requisicao', 'CLI-1');
  assert.equal(entrada.status, 0, entrada.stderr);
  assert.match(entrada.stdout, /saldo atual 10/);

  assert.match(cli(pasta, 'entrada', '--sku', 'MER-007', '--quantidade', '10', '--requisicao', 'CLI-1').stdout, /saldo atual 10/);

  const saldo = cli(pasta, 'saldo', '--sku', 'MER-007');
  assert.match(saldo.stdout, /Saldo atual: 10 UN \| mínimo 5 \| alvo 12/);
  assert.match(saldo.stdout, /ENTRADA {2}\+10 {2}saldo 10/);
});

test('CLI: entradas inválidas terminam com erro e mensagem clara', (t) => {
  const pasta = pastaTemporaria(t);
  cli(pasta, 'seed');
  for (const [quantidade, codigo] of [['-5', 'QTD_INVALIDA'], ['2,5', 'QTD_INVALIDA'], ['2.5', 'QTD_INVALIDA'], ['abc', 'QTD_INVALIDA']]) {
    const r = cli(pasta, 'entrada', '--sku', 'MER-001', '--quantidade', quantidade);
    assert.equal(r.status, 1);
    assert.match(r.stderr, new RegExp(codigo));
  }
  assert.match(cli(pasta, 'entrada', '--sku', 'MER-999', '--quantidade', '1').stderr, /SKU_INEXISTENTE/);
  assert.equal(cli(pasta, 'comando-inexistente').status, 2);
  assert.equal(cli(pasta, 'entrada', '--desconhecida', '1').status, 2);
  assert.match(cli(pasta, 'saldo', '--sku', 'MER-001').stdout, /Saldo atual: 0 UN/);
});
