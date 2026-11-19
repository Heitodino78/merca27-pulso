'use strict';
/* D-069: site estático do GitHub Pages — semente válida, deslocamento de datas íntegro e empacotamento seguro. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { carregarNucleo } = require('../local/nucleo');
const { gerarSemente, deslocarTabelas, gerarSite, DIA_REFERENCIA } = require('../local/gerar-site-estatico');

// Seis dias bastam para exercitar o deslocamento; a semente publicada tem 30.
const semente = gerarSemente({ dias: 6 });

function pulsoSobre(tabelas) {
  return carregarNucleo().criar({
    armazenamento: { ler: (t) => (tabelas[t] ?? []).map((l) => ({ ...l })), anexar: (t, l) => { (tabelas[t] ??= []).push({ ...l }); } },
    lock: { executar: (f) => f() }, relogio: () => new Date().toISOString(), gerarId: (p) => `${p}-TESTE-${Math.random().toString(36).slice(2)}`,
  });
}

test('semente da demonstração é gerada pelo núcleo e lida sem inconsistência', () => {
  const pulso = pulsoSobre(deslocarTabelas(semente.tabelas, 0));
  const produtos = pulso.listarProdutos();
  assert.equal(produtos.ok, true, JSON.stringify(produtos));
  assert.equal(produtos.produtos.length, 40);
  assert.equal(produtos.operacoesPendentes, 0);
  assert.ok(semente.tabelas.VENDAS.length > 20);
  assert.ok(semente.tabelas.MOVIMENTOS_ESTOQUE.some((m) => m.tipo === 'PERDA'));
  assert.equal(semente.diaReferencia, DIA_REFERENCIA);
});

test('semente é determinística', () => {
  assert.equal(JSON.stringify(gerarSemente({ dias: 6 })), JSON.stringify(semente));
});

test('deslocar as datas em dias inteiros mantém a base íntegra e o último dia vira o dia escolhido', () => {
  const { indicadores } = carregarNucleo();
  for (const dias of [0, 1, 45, 400]) {
    const pulso = pulsoSobre(deslocarTabelas(semente.tabelas, dias));
    const ultimo = new Date(Date.parse(`${DIA_REFERENCIA}T00:00:00.000Z`) + dias * 864e5).toISOString().slice(0, 10);
    const r = pulso.consultarIndicadores({ desde: indicadores.inicioDoDia(ultimo), ate: indicadores.inicioDoDia(indicadores.diaSeguinte(ultimo)) });
    assert.equal(r.ok, true, JSON.stringify(r));
    assert.ok(r.vendas.numero > 0, `há vendas no último dia (+${dias})`);
    // Uma operação nova depois do deslocamento continua aceita.
    assert.equal(pulso.confirmarVenda({ requisicaoId: `T-${dias}`, formaPagamentoFicticia: 'PIX', itens: [{ sku: 'MER-020', quantidade: 1 }] }).ok, true);
  }
});

test('deslocar só mexe em instantes, nunca em IDs ou valores', () => {
  const deslocada = deslocarTabelas(semente.tabelas, 10);
  assert.deepEqual(deslocada.VENDAS.map((v) => [v.venda_id, v.total_centavos]), semente.tabelas.VENDAS.map((v) => [v.venda_id, v.total_centavos]));
  assert.equal(Date.parse(deslocada.VENDAS[0].registrado_em) - Date.parse(semente.tabelas.VENDAS[0].registrado_em), 10 * 864e5);
});

test('empacota núcleo, semente e adaptador antes do bundle, sem conteúdo que feche a tag', (t) => {
  const pasta = fs.mkdtempSync(path.join(os.tmpdir(), 'pulso-site-'));
  t.after(() => fs.rmSync(pasta, { recursive: true, force: true }));
  const html = path.join(pasta, 'Interface.html');
  fs.writeFileSync(html, '<!doctype html><html><head><title>PULSO — MERCA 27 (demonstração)</title></head><body><script type="module">app()</script></body></html>');
  const r = gerarSite({ arquivoHtml: html, saida: path.join(pasta, 'site'), dias: 5 });
  const saida = fs.readFileSync(r.arquivo, 'utf8');
  assert.ok(fs.existsSync(path.join(pasta, 'site', '.nojekyll')));
  assert.match(saida, /^<!doctype html><html><head><script>\(function\(\)\{/);
  assert.ok(saida.indexOf('window.__PULSO_SEMENTE') < saida.indexOf('window.google = '));
  assert.ok(saida.indexOf('window.google = ') < saida.indexOf('<script type="module">'));
  assert.match(saida, /demonstração estática/);
  assert.equal((saida.match(/<\/script>/g) ?? []).length, 4, 'três scripts injetados e o original');
  assert.throws(() => gerarSite({ arquivoHtml: path.join(pasta, 'nao-existe.html'), saida: pasta }), /npm run interface:build/);
});
