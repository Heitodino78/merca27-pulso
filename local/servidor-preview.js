#!/usr/bin/env node
'use strict';
/*
 * Pré-visualização local da interface. Serve o HTML único empacotado e simula
 * google.script.run, chamando os mesmos casos de uso pelo despacho do núcleo.
 * Ferramenta de desenvolvimento: ouve somente em 127.0.0.1 e não é integração Google.
 */
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { criarPulsoLocal, aplicarCatalogo } = require('./app');
const { carregarNucleo } = require('./nucleo');

const HOST = '127.0.0.1';
const PORTA_PADRAO = 4827;
const LIMITE_CORPO = 256 * 1024;
const ARQUIVO_HTML_PADRAO = path.join(__dirname, '..', 'interface', 'dist', 'html-service', 'Interface.html');
const DADOS_PADRAO = process.env.PULSO_DADOS || path.join(__dirname, '..', 'data');

// Mesmo formato encadeável do google.script.run real; só existe a função pulsoChamar.
const SHIM_GOOGLE_SCRIPT_RUN = `<script>
(function () {
  'use strict';
  function Executor(sucesso, falha, objeto) { this._s = sucesso; this._f = falha; this._u = objeto; }
  Executor.prototype.withSuccessHandler = function (f) { return new Executor(f, this._f, this._u); };
  Executor.prototype.withFailureHandler = function (f) { return new Executor(this._s, f, this._u); };
  Executor.prototype.withUserObject = function (o) { return new Executor(this._s, this._f, o); };
  Executor.prototype.pulsoChamar = function (acao, pedido) {
    var self = this;
    fetch('/__preview/chamar', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ acao: acao, pedido: pedido }) })
      .then(function (r) {
        if (!r.ok) throw new Error('Falha de comunicação com o servidor (' + r.status + ').');
        return r.json();
      })
      .then(function (valor) { if (self._s) self._s(valor, self._u); },
        function (erro) { if (self._f) self._f(erro instanceof Error ? erro : new Error(String(erro)), self._u); });
  };
  window.google = { script: { run: new Executor(null, null, undefined) } };
  window.PULSO_PREVIEW_LOCAL = true;
})();
</script>`;

const CSP = "default-src 'none'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; " +
  "img-src 'self' data:; font-src 'self' data:; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'";

function injetarShim(html) {
  if (!html.includes('<head>')) throw new Error('HTML empacotado sem <head>.');
  return html.replace('<head>', `<head>${SHIM_GOOGLE_SCRIPT_RUN}`);
}

function hostPermitido(host) {
  return typeof host === 'string' && /^(127\.0\.0\.1|localhost):\d{1,5}$/.test(host);
}

function responder(res, status, corpo, tipo = 'application/json; charset=utf-8') {
  res.writeHead(status, {
    'Content-Type': tipo,
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    ...(tipo.startsWith('text/html') ? { 'Content-Security-Policy': CSP } : {}),
  });
  res.end(typeof corpo === 'string' ? corpo : JSON.stringify(corpo));
}

function lerCorpoJson(req) {
  return new Promise((resolver, rejeitar) => {
    if (!String(req.headers['content-type'] || '').startsWith('application/json')) {
      rejeitar(Object.assign(new Error('Use Content-Type application/json.'), { status: 415 }));
      return;
    }
    const partes = [];
    let tamanho = 0;
    req.on('data', (parte) => {
      tamanho += parte.length;
      if (tamanho > LIMITE_CORPO) {
        rejeitar(Object.assign(new Error('Corpo muito grande.'), { status: 413 }));
        req.destroy();
        return;
      }
      partes.push(parte);
    });
    req.on('end', () => {
      try {
        resolver(JSON.parse(Buffer.concat(partes).toString('utf8')));
      } catch {
        rejeitar(Object.assign(new Error('JSON inválido.'), { status: 400 }));
      }
    });
    req.on('error', rejeitar);
  });
}

/**
 * @param {{ diretorioDados?: string, arquivoHtml?: string, falhasSimuladas?: boolean, atrasoMs?: number }} [opcoes]
 */
function criarServidorPreview({ diretorioDados = DADOS_PADRAO, arquivoHtml = ARQUIVO_HTML_PADRAO, falhasSimuladas = false, atrasoMs = 0 } = {}) {
  const pulso = criarPulsoLocal(diretorioDados);
  const { despacho } = carregarNucleo();
  /** @type {null | 'antes' | 'depois'} */
  let proximaFalha = null;

  async function tratar(req, res) {
    if (!hostPermitido(req.headers.host)) return responder(res, 421, { erro: 'Host não permitido.' });
    const url = new URL(req.url || '/', `http://${req.headers.host}`);
    if (req.method === 'POST' && req.headers.origin && req.headers.origin !== `http://${req.headers.host}`) {
      return responder(res, 403, { erro: 'Origem não permitida.' });
    }

    if (url.pathname === '/' || url.pathname === '/index.html') {
      if (req.method !== 'GET') return responder(res, 405, { erro: 'Método não permitido.' });
      if (!fs.existsSync(arquivoHtml)) {
        return responder(res, 503, 'Interface ainda não empacotada. Execute npm run interface:build.', 'text/plain; charset=utf-8');
      }
      return responder(res, 200, injetarShim(fs.readFileSync(arquivoHtml, 'utf8')), 'text/html; charset=utf-8');
    }

    if (url.pathname === '/__preview/chamar') {
      if (req.method !== 'POST') return responder(res, 405, { erro: 'Método não permitido.' });
      const corpo = await lerCorpoJson(req);
      if (atrasoMs > 0) await new Promise((r) => setTimeout(r, atrasoMs));
      const falha = proximaFalha;
      proximaFalha = null;
      if (falha === 'antes') return responder(res, 503, { erro: 'Falha simulada antes de executar.' });
      const resultado = despacho.despachar(pulso, corpo && corpo.acao, corpo && corpo.pedido);
      if (falha === 'depois') return responder(res, 503, { erro: 'Falha simulada depois de executar: o retorno se perdeu.' });
      return responder(res, 200, resultado);
    }

    if (url.pathname === '/__preview/falha' && falhasSimuladas) {
      if (req.method !== 'POST') return responder(res, 405, { erro: 'Método não permitido.' });
      const corpo = await lerCorpoJson(req);
      if (!corpo || (corpo.modo !== 'antes' && corpo.modo !== 'depois')) return responder(res, 400, { erro: 'Use modo antes ou depois.' });
      proximaFalha = corpo.modo;
      return responder(res, 200, { ok: true, proximaFalha });
    }

    return responder(res, 404, { erro: 'Não encontrado.' });
  }

  const servidor = http.createServer((req, res) => {
    tratar(req, res).catch((erro) => {
      if (!res.headersSent) responder(res, erro.status || 500, { erro: erro.status ? erro.message : 'Erro interno da pré-visualização.' });
    });
  });

  return {
    pulso,
    servidor,
    /** @param {number} [porta] @returns {Promise<number>} */
    iniciar(porta = PORTA_PADRAO) {
      return new Promise((resolver, rejeitar) => {
        servidor.once('error', rejeitar);
        servidor.listen(porta, HOST, () => {
          const endereco = servidor.address();
          resolver(typeof endereco === 'object' && endereco ? endereco.port : porta);
        });
      });
    },
    encerrar() {
      return new Promise((resolver) => servidor.close(() => resolver(undefined)));
    },
  };
}

async function principal() {
  const argumentos = process.argv.slice(2);
  const desconhecidos = argumentos.filter((a) => !['--seed', '--falhas-simuladas'].includes(a));
  if (desconhecidos.length) {
    console.error(`Opção inválida: ${desconhecidos.join(' ')}\nUso: node local/servidor-preview.js [--seed] [--falhas-simuladas]`);
    process.exitCode = 1;
    return;
  }
  const porta = process.env.PULSO_PORTA ? Number(process.env.PULSO_PORTA) : PORTA_PADRAO;
  const atrasoMs = process.env.PULSO_PREVIEW_ATRASO_MS ? Number(process.env.PULSO_PREVIEW_ATRASO_MS) : 0;
  if (!Number.isInteger(porta) || porta < 0 || porta > 65535 || !Number.isInteger(atrasoMs) || atrasoMs < 0) {
    console.error('PULSO_PORTA e PULSO_PREVIEW_ATRASO_MS devem ser inteiros válidos.');
    process.exitCode = 1;
    return;
  }
  const preview = criarServidorPreview({ falhasSimuladas: argumentos.includes('--falhas-simuladas'), atrasoMs });
  if (argumentos.includes('--seed')) {
    const falha = aplicarCatalogo(preview.pulso).find((r) => !r.ok);
    if (falha) {
      console.error(`Seed rejeitada: ${falha.erro.codigo} ${falha.erro.mensagem}`);
      process.exitCode = 1;
      return;
    }
  }
  const portaReal = await preview.iniciar(porta);
  console.log(`PULSO — pré-visualização local em http://${HOST}:${portaReal}/`);
  console.log(`Dados: ${DADOS_PADRAO}. Não é integração Google. Ctrl+C encerra.`);
  if (argumentos.includes('--falhas-simuladas')) console.log('Falhas simuladas habilitadas em POST /__preview/falha.');
}

if (require.main === module) {
  principal().catch((erro) => {
    console.error(erro.message);
    process.exitCode = 1;
  });
}

module.exports = { criarServidorPreview, injetarShim, hostPermitido, HOST, SHIM_GOOGLE_SCRIPT_RUN };
