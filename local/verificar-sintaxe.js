'use strict';
/* Verifica a sintaxe de todos os arquivos JavaScript do projeto. */
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const raiz = path.join(__dirname, '..');
const arquivos = ['src', 'local', 'tests'].flatMap((pasta) =>
  fs.readdirSync(path.join(raiz, pasta), { recursive: true })
    .filter((nome) => nome.endsWith('.js'))
    .map((nome) => path.join(raiz, pasta, nome)));

const falhas = arquivos.filter((arquivo) => {
  const resultado = spawnSync(process.execPath, ['--check', arquivo], { stdio: 'inherit' });
  return resultado.status !== 0;
});
console.log(`Sintaxe verificada: ${arquivos.length} arquivo(s), ${falhas.length} com erro.`);
process.exitCode = falhas.length ? 1 : 0;
