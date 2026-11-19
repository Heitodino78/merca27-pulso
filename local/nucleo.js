'use strict';
/* Carrega src/ como o Apps Script faria: scripts em escopo global, sem require nem APIs do Node. */
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const RAIZ_SRC = path.join(__dirname, '..', 'src');

function listarFontes(diretorio = RAIZ_SRC) {
  return fs.readdirSync(diretorio, { withFileTypes: true }).flatMap((item) => {
    const caminho = path.join(diretorio, item.name);
    if (item.isDirectory()) return listarFontes(caminho);
    return item.name.endsWith('.js') ? [caminho] : [];
  }).sort();
}

function carregarNucleo({ inverterOrdem = false } = {}) {
  const contexto = vm.createContext({});
  const fontes = listarFontes();
  if (inverterOrdem) fontes.reverse();
  for (const arquivo of fontes) {
    vm.runInContext(fs.readFileSync(arquivo, 'utf8'), contexto, { filename: arquivo });
  }
  return vm.runInContext('PULSO', contexto);
}

module.exports = { carregarNucleo, listarFontes };
