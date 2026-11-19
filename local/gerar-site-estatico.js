#!/usr/bin/env node
'use strict';
/*
 * Versão estática da interface para o GitHub Pages (D-069). O Pages só serve arquivos, sem
 * servidor: o próprio núcleo de src/ roda no navegador, atrás do mesmo despacho e do mesmo
 * formato de google.script.run. Os dados ficam no localStorage de quem visita.
 *
 * O histórico fictício de ~30 dias é gerado aqui, no Node, com o núcleo real e relógio
 * controlado, e embutido no HTML. No navegador, todas as datas são deslocadas em dias
 * inteiros para que o último dia do exemplo seja o "hoje" de quem visita. Isso não é
 * integração Google nem um servidor: é uma demonstração isolada por navegador.
 */
const fs = require('node:fs');
const path = require('node:path');
const { carregarNucleo, listarFontes } = require('./nucleo');
const { aplicarCatalogo } = require('./app');
const { gerarCatalogo } = require('./gerar-fixtures');

const RAIZ = path.join(__dirname, '..');
const HTML_PADRAO = path.join(RAIZ, 'interface', 'dist', 'html-service', 'Interface.html');
const SAIDA_PADRAO = path.join(RAIZ, 'interface', 'dist', 'github-pages');
/** Dia de referência fixo: o arquivo gerado é sempre igual; o deslocamento acontece no navegador. */
const DIA_REFERENCIA = '2026-11-19';
const DESLOCAMENTO_MS = 3 * 60 * 60 * 1000; // America/Sao_Paulo como UTC−03:00 (D-064)
const DIA_MS = 24 * 60 * 60 * 1000;
const INSTANTE_GLOBAL = /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/g;

/** Instante UTC de um horário local (São Paulo) num dia relativo ao dia de referência. */
function instanteLocal(diasRelativos, hora, minuto = 0) {
  return Date.parse(`${DIA_REFERENCIA}T00:00:00.000Z`) + diasRelativos * DIA_MS + DESLOCAMENTO_MS + (hora * 60 + minuto) * 60000;
}

function criarAleatorio(semente) {
  let estado = semente >>> 0;
  return () => {
    estado = (estado + 0x6d2b79f5) >>> 0;
    let t = estado;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Histórico sintético e determinístico gerado pelos casos de uso reais (todas as regras e
 * conferências valem). Retorna as oito tabelas.
 */
function gerarSemente({ dias = 30, semente = 27 } = {}) {
  const nucleo = carregarNucleo();
  const tabelas = Object.fromEntries(Object.keys(nucleo.esquema.TABELAS).map((t) => [t, []]));
  let agora = instanteLocal(-dias - 1, 8);
  let sequencia = 0;
  const pulso = nucleo.criar({
    armazenamento: { ler: (t) => tabelas[t].map((l) => ({ ...l })), anexar: (t, l) => { tabelas[t].push({ ...l }); } },
    lock: { executar: (f) => f() },
    relogio: () => new Date(agora++).toISOString(),
    gerarId: (p) => `${p}-DEMO-${String(++sequencia).padStart(6, '0')}`,
  });
  const exigir = (r) => {
    if (!r.ok) throw new Error(`Semente da demonstração recusada: ${JSON.stringify(r.erro)}`);
    return r;
  };
  const aleatorio = criarAleatorio(semente);
  const entre = (a, b) => a + Math.floor(aleatorio() * (b - a + 1));
  let req = 0;
  const chave = (tipo) => `DEMO-${tipo}-${++req}`;

  aplicarCatalogo(pulso).forEach(exigir);
  const produtos = gerarCatalogo(semente).produtos;
  const saldos = new Map();
  for (const p of produtos) {
    const quantidade = p.estoqueAlvo * 2 + entre(0, 6);
    exigir(pulso.registrarSaldoInicial({ requisicaoId: chave('INI'), sku: p.sku, quantidade, custoUnitCentavos: p.custoRefCentavos, motivo: 'Inventário inicial fictício' }));
    saldos.set(p.sku, quantidade);
  }
  // Os primeiros oito SKUs vendem mais; dois deles deixam de ser repostos no fim, para haver alerta.
  const pesos = produtos.flatMap((p, i) => Array(i < 8 ? 5 : 1).fill(p));
  const semReposicaoFinal = new Set(['MER-002', 'MER-004', 'MER-007']);
  const vendasPorDia = new Map();
  const PAGAMENTOS = ['PIX', 'PIX', 'CARTAO', 'DINHEIRO'];
  const PERDAS = ['AVARIA', 'VENCIMENTO', 'QUEBRA'];

  for (let d = -dias; d <= 0; d++) {
    // Entradas a cada quatro dias, de manhã.
    if ((d + dias) % 4 === 0) {
      let minuto = 0;
      for (const p of produtos) {
        if (d > -10 && semReposicaoFinal.has(p.sku)) continue;
        const saldo = saldos.get(p.sku);
        if (saldo >= p.estoqueMinimo * 2) continue;
        const quantidade = p.estoqueAlvo * 2 - saldo;
        agora = instanteLocal(d, 7, minuto++);
        exigir(pulso.registrarEntrada({ requisicaoId: chave('ENT'), sku: p.sku, quantidade, fornecedorId: p.fornecedorId,
          custoUnitCentavos: p.custoRefCentavos + entre(-10, 10), referenciaFornecedor: `NF-DEMO-${req}` }));
        saldos.set(p.sku, saldo + quantidade);
      }
    }
    if (d === -20) {
      agora = instanteLocal(d, 7, 50);
      exigir(pulso.alterarProduto({ requisicaoId: chave('ALT'), sku: 'MER-003', motivo: 'Reajuste fictício',
        campos: { precoVendaCentavos: Math.round(produtos[2].precoVendaCentavos * 1.1) } }));
    }
    // Vendas ao longo do dia; no último dia, só de manhã cedo.
    const quantidadeVendas = d === 0 ? 3 : entre(4, 8);
    const ids = [];
    for (let v = 0; v < quantidadeVendas; v++) {
      const escolhidos = new Map();
      for (let i = entre(1, 3); i > 0; i--) {
        const p = pesos[entre(0, pesos.length - 1)];
        const quantidade = entre(1, 3);
        if (!escolhidos.has(p.sku) && saldos.get(p.sku) >= quantidade) escolhidos.set(p.sku, quantidade);
      }
      if (!escolhidos.size) continue;
      agora = d === 0 ? instanteLocal(d, 6, 10 + v * 12) : instanteLocal(d, 9 + Math.floor((v * 11) / quantidadeVendas), entre(0, 59));
      const r = exigir(pulso.confirmarVenda({ requisicaoId: chave('VEN'), formaPagamentoFicticia: PAGAMENTOS[entre(0, 3)],
        itens: [...escolhidos].map(([sku, quantidade]) => ({ sku, quantidade })) }));
      for (const [sku, quantidade] of escolhidos) saldos.set(sku, saldos.get(sku) - quantidade);
      ids.push({ vendaId: r.vendaId, itens: escolhidos });
    }
    vendasPorDia.set(d, ids);
    // Uma perda a cada três dias.
    if ((d + dias) % 3 === 1) {
      const p = pesos[entre(0, pesos.length - 1)];
      if (saldos.get(p.sku) > 0) {
        agora = instanteLocal(d, 21, 0);
        exigir(pulso.registrarPerda({ requisicaoId: chave('PER'), sku: p.sku, quantidade: 1, categoriaPerda: PERDAS[(d + dias) % 3], motivo: 'Perda fictícia de demonstração' }));
        saldos.set(p.sku, saldos.get(p.sku) - 1);
      }
    }
    if (d === -12) {
      agora = instanteLocal(d, 21, 30);
      const sku = 'MER-010';
      const contada = Math.max(0, saldos.get(sku) - 2);
      exigir(pulso.ajustarPorContagem({ requisicaoId: chave('AJU'), sku, quantidadeContada: contada, motivo: 'Contagem fictícia' }));
      saldos.set(sku, contada);
    }
    // Estornos: um no dia seguinte à venda e outro de uma venda de uma semana antes.
    for (const [diaEstorno, diaVenda] of [[-15, -16], [-2, -9]]) {
      if (d !== diaEstorno) continue;
      const alvo = vendasPorDia.get(diaVenda)?.[0];
      if (!alvo) continue;
      agora = instanteLocal(d, 19, 0);
      exigir(pulso.estornarVenda({ requisicaoId: chave('EST'), vendaId: alvo.vendaId, motivo: 'Devolução fictícia' }));
      for (const [sku, quantidade] of alvo.itens) saldos.set(sku, saldos.get(sku) + quantidade);
    }
  }
  return { diaReferencia: DIA_REFERENCIA, tabelas };
}

/** Desloca todos os instantes em dias inteiros (mesma operação que o navegador faz ao abrir). */
function deslocarTabelas(tabelas, dias) {
  const texto = JSON.stringify(tabelas);
  if (!dias) return JSON.parse(texto);
  return JSON.parse(texto.replace(INSTANTE_GLOBAL, (iso) => new Date(Date.parse(iso) + dias * DIA_MS).toISOString()));
}

/** Adaptador do navegador: mesmas portas do núcleo, google.script.run local e botão de restaurar. */
const ADAPTADOR = String.raw`
(function () {
  'use strict';
  var CHAVE = 'merca27-pulso-demo-v1';
  var NUCLEO = window.__PULSO_NUCLEO;
  var SEMENTE = window.__PULSO_SEMENTE;
  var DESLOCAMENTO = ${DESLOCAMENTO_MS}, DIA = ${DIA_MS};
  var INSTANTE = /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/g;
  function diaLocal(ms) { return new Date(ms - DESLOCAMENTO).toISOString().slice(0, 10); }
  function semente() {
    var dias = Math.round((Date.parse(diaLocal(Date.now()) + 'T00:00:00.000Z') - Date.parse(SEMENTE.diaReferencia + 'T00:00:00.000Z')) / DIA);
    var texto = JSON.stringify(SEMENTE.tabelas);
    return JSON.parse(dias ? texto.replace(INSTANTE, function (iso) { return new Date(Date.parse(iso) + dias * DIA).toISOString(); }) : texto);
  }
  var tabelas = null;
  try { var salvo = window.localStorage.getItem(CHAVE); if (salvo) tabelas = JSON.parse(salvo); } catch (e) { tabelas = null; }
  if (!tabelas || typeof tabelas !== 'object') tabelas = semente();
  Object.keys(NUCLEO.esquema.TABELAS).forEach(function (t) { if (!Array.isArray(tabelas[t])) tabelas[t] = []; });
  function salvar() { try { window.localStorage.setItem(CHAVE, JSON.stringify(tabelas)); } catch (e) { /* sem armazenamento: vale só nesta aba */ } }
  function novoId(prefixo) {
    var c = window.crypto;
    if (c && typeof c.randomUUID === 'function') return prefixo + '-' + c.randomUUID();
    return prefixo + '-' + Date.now().toString(36) + Math.random().toString(36).slice(2);
  }
  var pulso = NUCLEO.criar({
    armazenamento: {
      ler: function (t) { return (tabelas[t] || []).map(function (l) { return Object.assign({}, l); }); },
      anexar: function (t, l) { tabelas[t].push(Object.assign({}, l)); },
    },
    lock: { executar: function (f) { return f(); } },
    relogio: function () { return new Date().toISOString(); },
    gerarId: novoId,
  });
  function Executor(s, f, u) { this._s = s; this._f = f; this._u = u; }
  Executor.prototype.withSuccessHandler = function (f) { return new Executor(f, this._f, this._u); };
  Executor.prototype.withFailureHandler = function (f) { return new Executor(this._s, f, this._u); };
  Executor.prototype.withUserObject = function (o) { return new Executor(this._s, this._f, o); };
  Executor.prototype.pulsoChamar = function (acao, pedido) {
    var self = this;
    // Assíncrono e com cópia do pedido, como uma chamada ao servidor.
    var copia = pedido === undefined || pedido === null ? pedido : JSON.parse(JSON.stringify(pedido));
    setTimeout(function () {
      var resultado;
      try { resultado = NUCLEO.despacho.despachar(pulso, acao, copia); salvar(); }
      catch (erro) { if (self._f) self._f(erro instanceof Error ? erro : new Error(String(erro)), self._u); return; }
      if (self._s) self._s(JSON.parse(JSON.stringify(resultado)), self._u);
    }, 0);
  };
  window.google = { script: { run: new Executor(null, null, undefined) } };
  window.PULSO_DEMO_ESTATICA = true;

  function selo() {
    var caixa = document.createElement('div');
    caixa.setAttribute('role', 'note');
    caixa.style.cssText = 'position:fixed;right:12px;bottom:12px;z-index:40;display:flex;gap:8px;align-items:center;max-width:calc(100vw - 24px);' +
      'padding:8px 10px;border-radius:10px;background:#0f4a41;color:#dceae4;font:600 12px/1.3 system-ui,sans-serif;box-shadow:0 8px 24px -10px rgba(15,74,65,.6)';
    var texto = document.createElement('span');
    texto.textContent = 'Demo estática: o núcleo roda no seu navegador e os dados ficam só aqui.';
    var botao = document.createElement('button');
    botao.type = 'button';
    botao.textContent = 'Restaurar exemplo';
    botao.style.cssText = 'flex:none;min-height:32px;padding:4px 10px;border-radius:8px;border:1px solid #dceae4;background:transparent;color:#ffffff;font:inherit;cursor:pointer';
    botao.addEventListener('click', function () {
      if (!window.confirm('Apagar o que você registrou neste navegador e restaurar os dados de exemplo?')) return;
      try { window.localStorage.removeItem(CHAVE); } catch (e) { /* nada salvo */ }
      window.location.reload();
    });
    caixa.appendChild(texto);
    caixa.appendChild(botao);
    document.body.appendChild(caixa);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', selo); else selo();
})();
`;

function scriptSeguro(conteudo, origem) {
  for (const proibido of ['</script', '<!--', '<script']) {
    if (conteudo.toLowerCase().includes(proibido)) throw new Error(`${origem} contém "${proibido}" e não pode ser embutido.`);
  }
  return conteudo;
}

/** Gera index.html (+ .nojekyll) com núcleo, semente e adaptador antes do bundle Angular. */
function gerarSite({ arquivoHtml = HTML_PADRAO, saida = SAIDA_PADRAO, dias = 30 } = {}) {
  if (!fs.existsSync(arquivoHtml)) throw new Error(`HTML único não encontrado em ${arquivoHtml}. Execute npm run interface:build.`);
  const html = fs.readFileSync(arquivoHtml, 'utf8');
  if (!html.includes('<head>')) throw new Error('HTML único sem <head>.');
  const nucleo = listarFontes().map((f) => scriptSeguro(fs.readFileSync(f, 'utf8'), path.relative(RAIZ, f))).join('\n');
  const semente = gerarSemente({ dias });
  // "<" escapado: nenhum texto da semente consegue fechar a tag script.
  const json = JSON.stringify(semente).replace(/</g, '\\u003c');
  const injetado = `<script>(function(){\n${nucleo}\nwindow.__PULSO_NUCLEO = PULSO;\n})();</script>` +
    `<script>window.__PULSO_SEMENTE = ${json};</script>` +
    `<script>${scriptSeguro(ADAPTADOR, 'adaptador')}</script>`;
  const final = html
    .replace('<head>', `<head>${injetado}`)
    .replace('<title>PULSO — MERCA 27 (demonstração)</title>', '<title>PULSO — MERCA 27 (demonstração estática)</title>');
  fs.mkdirSync(saida, { recursive: true });
  fs.writeFileSync(path.join(saida, 'index.html'), final, 'utf8');
  fs.writeFileSync(path.join(saida, '.nojekyll'), '');
  const linhas = Object.values(semente.tabelas).reduce((s, t) => s + t.length, 0);
  return { arquivo: path.join(saida, 'index.html'), bytes: Buffer.byteLength(final), linhas, vendas: semente.tabelas.VENDAS.length };
}

if (require.main === module) {
  try {
    const r = gerarSite();
    console.log(`Site estático: ${path.relative(RAIZ, r.arquivo)} — ${r.bytes} bytes (${(r.bytes / 1024).toFixed(1)} KiB), ${r.linhas} linhas de exemplo, ${r.vendas} vendas.`);
  } catch (erro) {
    console.error(`Site estático recusado: ${erro.message}`);
    process.exitCode = 1;
  }
}

module.exports = { gerarSemente, deslocarTabelas, gerarSite, DIA_REFERENCIA };
