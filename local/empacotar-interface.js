#!/usr/bin/env node
'use strict';
/*
 * Junta o build do Angular num único HTML autocontido, como o HtmlService exige:
 * CSS e JS embutidos, sem chunks separados, sem arquivos externos.
 */
const fs = require('node:fs');
const path = require('node:path');

const RAIZ = path.join(__dirname, '..');
const BUILD_PADRAO = path.join(RAIZ, 'interface', 'dist', 'pulso-interface', 'browser');
const SAIDA_PADRAO = path.join(RAIZ, 'interface', 'dist', 'html-service', 'Interface.html');
const PERMITIDOS_EXTRAS = ['index.html', '3rdpartylicenses.txt'];

function conferirEmbutivel(conteudo, arquivo, fechamento) {
  for (const proibido of [fechamento, '<!--', '<script']) {
    if (conteudo.toLowerCase().includes(proibido)) {
      throw new Error(`${arquivo} contém "${proibido}" e não pode ser embutido com segurança.`);
    }
  }
}

/** @param {string} [dirBuild] @param {string} [arquivoSaida] */
function empacotar(dirBuild = BUILD_PADRAO, arquivoSaida = SAIDA_PADRAO) {
  const indice = path.join(dirBuild, 'index.html');
  if (!fs.existsSync(indice)) throw new Error(`Build não encontrado em ${dirBuild}. Execute o build do Angular.`);
  let html = fs.readFileSync(indice, 'utf8');
  const usados = new Set(['index.html']);

  html = html.replace(/<link\b[^>]*\brel="stylesheet"[^>]*>/g, (tag) => {
    const href = /\bhref="([^"]+)"/.exec(tag);
    if (!href || /^[a-z]+:|^\/\//i.test(href[1]) || /\bmedia="print"/.test(tag)) throw new Error(`Folha de estilo não embutível: ${tag}`);
    const css = fs.readFileSync(path.join(dirBuild, href[1]), 'utf8');
    conferirEmbutivel(css, href[1], '</style');
    usados.add(href[1]);
    return `<style>${css}</style>`;
  });

  html = html.replace(/<script\b([^>]*)\bsrc="([^"]+)"([^>]*)><\/script>/g, (tag, antes, src, depois) => {
    if (/^[a-z]+:|^\/\//i.test(src)) throw new Error(`Script externo não permitido: ${src}`);
    const js = fs.readFileSync(path.join(dirBuild, src), 'utf8');
    conferirEmbutivel(js, src, '</script');
    usados.add(src);
    const modulo = /type="module"/.test(antes + depois);
    return `<script${modulo ? ' type="module"' : ''}>${js}</script>`;
  });

  if (/<link\b[^>]*\b(rel="modulepreload"|rel="preload"|href=")/.test(html) || /\bsrc="/.test(html)) {
    throw new Error('O HTML ainda referencia arquivos externos depois do empacotamento.');
  }
  if (/<base\b/i.test(html)) throw new Error('Remova <base>: o HTML Service roda num iframe e a interface usa rotas por hash.');

  const sobras = fs.readdirSync(dirBuild, { recursive: true, encoding: 'utf8' })
    .filter((nome) => fs.statSync(path.join(dirBuild, nome)).isFile())
    .filter((nome) => !usados.has(nome) && !PERMITIDOS_EXTRAS.includes(nome));
  if (sobras.length) throw new Error(`Arquivos que não caberiam no HTML único (chunks ou recursos): ${sobras.join(', ')}`);

  fs.mkdirSync(path.dirname(arquivoSaida), { recursive: true });
  fs.writeFileSync(arquivoSaida, html, 'utf8');
  return { arquivo: arquivoSaida, bytes: Buffer.byteLength(html, 'utf8'), embutidos: [...usados].filter((n) => n !== 'index.html') };
}

if (require.main === module) {
  try {
    const resultado = empacotar();
    console.log(`HTML único: ${path.relative(RAIZ, resultado.arquivo)} — ${resultado.bytes} bytes (${(resultado.bytes / 1024).toFixed(1)} KiB).`);
    console.log(`Embutidos: ${resultado.embutidos.join(', ')}`);
  } catch (erro) {
    console.error(`Empacotamento recusado: ${erro.message}`);
    process.exitCode = 1;
  }
}

module.exports = { empacotar, BUILD_PADRAO, SAIDA_PADRAO };
