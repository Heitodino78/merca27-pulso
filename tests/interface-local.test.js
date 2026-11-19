'use strict';
/* M-06: despacho do núcleo, servidor de pré-visualização (127.0.0.1) e empacotamento em HTML único. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { carregarNucleo } = require('../local/nucleo');
const { criarAmbiente, PRODUTO_BASE } = require('./apoio');
const { criarServidorPreview, injetarShim, hostPermitido } = require('../local/servidor-preview');
const { empacotar } = require('../local/empacotar-interface');

const ENTRADA = { requisicaoId: 'REQ-UI-ENT-1', sku: 'MER-001', quantidade: 10, custoUnitCentavos: 600, fornecedorId: 'FOR-001' };

function preparar() {
  const ambiente = criarAmbiente();
  ambiente.pulso.cadastrarProduto({ ...PRODUTO_BASE });
  return { ...ambiente, despacho: carregarNucleo().despacho };
}

test('despacho expõe somente as ações da interface, sem cadastrar fornecedor nem contagem', () => {
  const { despacho } = preparar();
  assert.deepEqual([...despacho.ACOES].sort(), [
    'ajustarPorContagem', 'alterarProduto', 'cadastrarProduto', 'confirmarVenda', 'consultarEstoque', 'consultarHistoricoProduto',
    'consultarReposicao', 'consultarVenda', 'desativarProduto', 'estornarVenda', 'listarFornecedores', 'listarProdutos', 'listarVendas',
    'reativarProduto', 'reconciliarPendencias', 'registrarEntrada', 'registrarPerda', 'registrarSaldoInicial',
  ]);
  assert.equal(despacho.ACOES.includes('registrarContagem'), false);
  assert.equal(despacho.ACOES.includes('cadastrarFornecedor'), false);
});

test('despacho recusa ação desconhecida, protótipo e nome não textual sem gravar', () => {
  const { pulso, despacho, armazenamento } = preparar();
  const antes = JSON.stringify(armazenamento.tabelas);
  for (const acao of ['cadastrarFornecedor', 'constructor', '__proto__', 'toString', 'criar', '', null, 42, ['listarProdutos']]) {
    const r = despacho.despachar(pulso, acao, { requisicaoId: 'X-1' });
    assert.equal(r.ok, false);
    assert.equal(r.erro.codigo, 'ACAO_DESCONHECIDA');
  }
  assert.equal(JSON.stringify(armazenamento.tabelas), antes);
});

test('despacho exige objeto nas ações com pedido e nada nas consultas sem pedido', () => {
  const { pulso, despacho } = preparar();
  for (const pedido of [undefined, null, 'MER-001', 7, ['MER-001']]) {
    assert.equal(despacho.despachar(pulso, 'consultarEstoque', pedido).erro.codigo, 'DADOS_INVALIDOS');
  }
  assert.equal(despacho.despachar(pulso, 'listarProdutos', { sku: 'MER-001' }).erro.codigo, 'DADOS_INVALIDOS');
  assert.equal(despacho.despachar(pulso, 'listarProdutos').ok, true);
  assert.equal(despacho.despachar(pulso, 'listarProdutos', null).ok, true);
});

test('despacho repassa o mesmo resultado do caso de uso, inclusive idempotência e conflito', () => {
  const { pulso, despacho } = preparar();
  const primeira = despacho.despachar(pulso, 'registrarEntrada', ENTRADA);
  assert.equal(primeira.ok, true);
  assert.equal(primeira.saldoAtual, 10);
  const repetida = despacho.despachar(pulso, 'registrarEntrada', ENTRADA);
  assert.equal(repetida.aviso, 'OPERACAO_DUPLICADA');
  assert.equal(repetida.saldoAtual, 10);
  const conflito = despacho.despachar(pulso, 'registrarEntrada', { ...ENTRADA, quantidade: 11 });
  assert.equal(conflito.erro.codigo, 'REQUISICAO_CONFLITANTE');
  assert.equal(despacho.despachar(pulso, 'consultarEstoque', { sku: 'MER-001' }).saldoAtual, 10);
});

test('despacho transforma exceção inesperada em falha incerta, sem propagar', () => {
  const { despacho } = preparar();
  const quebrado = { registrarEntrada() { throw new Error('quebra'); } };
  const r = despacho.despachar(quebrado, 'registrarEntrada', ENTRADA);
  assert.equal(r.ok, false);
  assert.equal(r.erro.codigo, 'FALHA_INESPERADA');
});

test('shim simula google.script.run no início do head e só aceita hosts locais', () => {
  const html = injetarShim('<!doctype html><html><head><title>x</title></head><body></body></html>');
  assert.match(html, /^<!doctype html><html><head><script>/);
  assert.match(html, /pulsoChamar/);
  assert.throws(() => injetarShim('<html><body></body></html>'), /sem <head>/);
  assert.equal(hostPermitido('127.0.0.1:4827'), true);
  assert.equal(hostPermitido('localhost:4827'), true);
  for (const host of ['exemplo.invalid:4827', '127.0.0.1.exemplo.invalid:4827', '0.0.0.0:4827', '', undefined, '127.0.0.1']) {
    assert.equal(hostPermitido(host), false, String(host));
  }
});

async function comServidor(opcoes, funcao) {
  const pasta = fs.mkdtempSync(path.join(os.tmpdir(), 'pulso-preview-'));
  const html = path.join(pasta, 'Interface.html');
  fs.writeFileSync(html, '<!doctype html><html><head><title>PULSO</title></head><body>ok</body></html>');
  const preview = criarServidorPreview({ diretorioDados: path.join(pasta, 'dados'), arquivoHtml: html, ...opcoes });
  const porta = await preview.iniciar(0);
  try {
    await funcao({ base: `http://127.0.0.1:${porta}`, porta, preview, pasta });
  } finally {
    await preview.encerrar();
    fs.rmSync(pasta, { recursive: true, force: true });
  }
}

const chamar = (base, corpo, cabecalhos = {}) => fetch(`${base}/__preview/chamar`, {
  method: 'POST', headers: { 'Content-Type': 'application/json', ...cabecalhos }, body: JSON.stringify(corpo),
});

test('servidor de pré-visualização ouve só em 127.0.0.1 e serve o HTML com shim e CSP', async () => {
  await comServidor({}, async ({ base, preview }) => {
    assert.equal(preview.servidor.address().address, '127.0.0.1');
    const r = await fetch(`${base}/`);
    assert.equal(r.status, 200);
    assert.match(r.headers.get('content-security-policy'), /default-src 'none'/);
    assert.match(r.headers.get('content-security-policy'), /connect-src 'self'/);
    assert.equal(r.headers.get('cache-control'), 'no-store');
    const texto = await r.text();
    assert.match(texto, /window\.google = \{ script: \{ run:/);
    assert.equal((await fetch(`${base}/nada`)).status, 404);
    assert.equal((await fetch(`${base}/__preview/chamar`)).status, 405);
  });
});

test('servidor chama os mesmos casos de uso pelo despacho e preserva idempotência', async () => {
  await comServidor({}, async ({ base, preview }) => {
    preview.pulso.cadastrarFornecedor({ requisicaoId: 'F-1', fornecedorId: 'FOR-001', nomeFicticio: 'Fornecedor Fictício', categoriaPrincipal: 'MERCEARIA', prazoEstimadoDias: 2 });
    preview.pulso.cadastrarProduto({ ...PRODUTO_BASE });
    const primeira = await (await chamar(base, { acao: 'registrarEntrada', pedido: ENTRADA })).json();
    assert.equal(primeira.ok, true);
    const segunda = await (await chamar(base, { acao: 'registrarEntrada', pedido: ENTRADA })).json();
    assert.equal(segunda.aviso, 'OPERACAO_DUPLICADA');
    const conflito = await (await chamar(base, { acao: 'registrarEntrada', pedido: { ...ENTRADA, quantidade: 3 } })).json();
    assert.equal(conflito.erro.codigo, 'REQUISICAO_CONFLITANTE');
    const fornecedor = await (await chamar(base, { acao: 'cadastrarFornecedor', pedido: { requisicaoId: 'F-2' } })).json();
    assert.equal(fornecedor.erro.codigo, 'ACAO_DESCONHECIDA');
    const saldo = await (await chamar(base, { acao: 'consultarEstoque', pedido: { sku: 'MER-001' } })).json();
    assert.equal(saldo.saldoAtual, 10);
    assert.equal(saldo.totalMovimentos, 1);
  });
});

test('servidor recusa host estranho, origem cruzada, tipo errado, JSON inválido e corpo grande', async () => {
  await comServidor({}, async ({ base, porta }) => {
    const http = require('node:http');
    const status = await new Promise((resolver, rejeitar) => {
      const req = http.request({ host: '127.0.0.1', port: porta, path: '/', headers: { Host: 'atacante.invalid' } }, (res) => {
        res.resume();
        resolver(res.statusCode);
      });
      req.on('error', rejeitar);
      req.end();
    });
    assert.equal(status, 421);
    assert.equal((await chamar(base, { acao: 'listarProdutos' }, { Origin: 'http://atacante.invalid' })).status, 403);
    const textoPlano = await fetch(`${base}/__preview/chamar`, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: '{}' });
    assert.equal(textoPlano.status, 415);
    const invalido = await fetch(`${base}/__preview/chamar`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{' });
    assert.equal(invalido.status, 400);
    const grande = await fetch(`${base}/__preview/chamar`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ acao: 'x', pedido: 'a'.repeat(300 * 1024) }),
    }).then((r) => r.status, () => 413);
    assert.equal(grande, 413);
  });
});

test('falhas simuladas só existem quando habilitadas e cobrem antes e depois de executar', async () => {
  await comServidor({}, async ({ base }) => {
    const r = await fetch(`${base}/__preview/falha`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"modo":"antes"}' });
    assert.equal(r.status, 404);
  });
  await comServidor({ falhasSimuladas: true }, async ({ base, preview }) => {
    preview.pulso.cadastrarFornecedor({ requisicaoId: 'F-1', fornecedorId: 'FOR-001', nomeFicticio: 'Fornecedor Fictício', categoriaPrincipal: 'MERCEARIA', prazoEstimadoDias: 2 });
    preview.pulso.cadastrarProduto({ ...PRODUTO_BASE });
    const falhar = (modo) => fetch(`${base}/__preview/falha`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ modo }) });

    assert.equal((await falhar('antes')).status, 200);
    assert.equal((await chamar(base, { acao: 'registrarEntrada', pedido: ENTRADA })).status, 503);
    assert.equal(preview.pulso.consultarEstoque({ sku: 'MER-001' }).saldoAtual, 0, 'antes: nada gravado');

    assert.equal((await falhar('depois')).status, 200);
    assert.equal((await chamar(base, { acao: 'registrarEntrada', pedido: ENTRADA })).status, 503);
    assert.equal(preview.pulso.consultarEstoque({ sku: 'MER-001' }).saldoAtual, 10, 'depois: gravado, retorno perdido');

    const repetida = await (await chamar(base, { acao: 'registrarEntrada', pedido: ENTRADA })).json();
    assert.equal(repetida.aviso, 'OPERACAO_DUPLICADA');
    assert.equal(repetida.saldoAtual, 10, 'repetir com a mesma chave não duplica');
    assert.equal((await falhar('outro')).status, 400);
  });
});

test('sem HTML empacotado, o servidor orienta o build em vez de falhar', async () => {
  await comServidor({}, async ({ base, pasta }) => {
    fs.rmSync(path.join(pasta, 'Interface.html'));
    const r = await fetch(`${base}/`);
    assert.equal(r.status, 503);
    assert.match(await r.text(), /npm run interface:build/);
  });
});

function buildFalso(arquivos) {
  const pasta = fs.mkdtempSync(path.join(os.tmpdir(), 'pulso-build-'));
  for (const [nome, conteudo] of Object.entries(arquivos)) fs.writeFileSync(path.join(pasta, nome), conteudo);
  return pasta;
}

test('empacotamento embute CSS e JS e gera um único HTML sem referências externas', () => {
  const pasta = buildFalso({
    'index.html': '<!doctype html><html><head><link rel="stylesheet" href="styles.css"></head><body><x-app></x-app><script src="main.js" type="module"></script></body></html>',
    'styles.css': 'body{color:#1b2725}',
    'main.js': 'console.log("pulso")',
    '3rdpartylicenses.txt': 'MIT',
  });
  const saida = path.join(pasta, 'saida', 'Interface.html');
  const r = empacotar(pasta, saida);
  const html = fs.readFileSync(saida, 'utf8');
  assert.equal(html, '<!doctype html><html><head><style>body{color:#1b2725}</style></head><body><x-app></x-app><script type="module">console.log("pulso")</script></body></html>');
  assert.deepEqual(r.embutidos.sort(), ['main.js', 'styles.css']);
  assert.equal(r.bytes, Buffer.byteLength(html));
  fs.rmSync(pasta, { recursive: true, force: true });
});

test('empacotamento recusa chunks extras, base href, recursos externos e conteúdo que fecharia a tag', () => {
  const casos = [
    [{ 'index.html': '<html><head></head><body><script src="main.js" type="module"></script></body></html>', 'main.js': 'x', 'chunk-ABC.js': 'y' }, /chunk-ABC\.js/],
    [{ 'index.html': '<html><head><base href="/"></head><body><script src="main.js" type="module"></script></body></html>', 'main.js': 'x' }, /<base>/],
    [{ 'index.html': '<html><head></head><body><script src="https://cdn.invalid/x.js"></script></body></html>' }, /externo/],
    [{ 'index.html': '<html><head><link rel="stylesheet" href="s.css" media="print" onload="this.media=\'all\'"></head><body></body></html>', 's.css': 'a{}' }, /não embutível/],
    [{ 'index.html': '<html><head></head><body><script src="main.js" type="module"></script></body></html>', 'main.js': 'const s="</script>"' }, /<\/script/],
    [{ 'index.html': '<html><head><link rel="modulepreload" href="chunk.js"></head><body><script src="main.js" type="module"></script></body></html>', 'main.js': 'x' }, /externos/],
  ];
  for (const [arquivos, erro] of casos) {
    const pasta = buildFalso(arquivos);
    assert.throws(() => empacotar(pasta, path.join(pasta, 'out', 'Interface.html')), erro);
    assert.equal(fs.existsSync(path.join(pasta, 'out', 'Interface.html')), false);
    fs.rmSync(pasta, { recursive: true, force: true });
  }
});
