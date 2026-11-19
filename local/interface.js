#!/usr/bin/env node
'use strict';
/*
 * Executa as ferramentas do Angular em interface/ neste volume vfat.
 * O vfat está montado com showexec: nenhum binário nativo pode ser executado dali,
 * e o esbuild é um binário. Copiamos o binário da versão instalada para a pasta
 * temporária do sistema e apontamos ESBUILD_BINARY_PATH para a cópia. Nada é global.
 */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { empacotar } = require('./empacotar-interface');

const DIR = path.join(__dirname, '..', 'interface');
const MODULOS = path.join(DIR, 'node_modules');

function exigirInstalacao() {
  if (!fs.existsSync(path.join(MODULOS, '@angular', 'cli'))) {
    throw new Error('Dependências da interface ausentes. Execute npm run interface:instalar.');
  }
}

function prepararEsbuild() {
  const base = path.join(MODULOS, '@angular', 'build', 'package.json');
  const pacoteEsbuild = require.resolve('esbuild/package.json', { paths: [path.dirname(base)] });
  const versao = JSON.parse(fs.readFileSync(pacoteEsbuild, 'utf8')).version;
  const plataforma = `${process.platform}-${process.arch}`;
  const binario = require.resolve(`@esbuild/${plataforma}/package.json`, { paths: [path.dirname(pacoteEsbuild)] });
  const origem = path.join(path.dirname(binario), 'bin', 'esbuild');
  const destino = path.join(os.tmpdir(), `merca27-esbuild-${versao}-${plataforma}`);
  const tamanho = fs.statSync(origem).size;
  if (!fs.existsSync(destino) || fs.statSync(destino).size !== tamanho) fs.copyFileSync(origem, destino);
  fs.chmodSync(destino, 0o755);
  return destino;
}

function executar(script, argumentos) {
  const resultado = spawnSync(process.execPath, [script, ...argumentos], {
    cwd: DIR,
    stdio: 'inherit',
    env: { ...process.env, ESBUILD_BINARY_PATH: prepararEsbuild(), NG_CLI_ANALYTICS: 'false', NG_FORCE_TTY: 'false' },
  });
  if (resultado.error) throw resultado.error;
  return resultado.status ?? 1;
}

const ng = (argumentos) => executar(path.join(MODULOS, '@angular', 'cli', 'bin', 'ng.js'), argumentos);
const tsc = (projeto) => executar(path.join(MODULOS, 'typescript', 'lib', 'tsc.js'), ['-p', projeto, '--noEmit']);

const comandos = {
  build() {
    const status = ng(['build']);
    if (status !== 0) return status;
    const resultado = empacotar();
    console.log(`HTML único: ${path.relative(path.join(DIR, '..'), resultado.arquivo)} — ${resultado.bytes} bytes (${(resultado.bytes / 1024).toFixed(1)} KiB).`);
    return 0;
  },
  test: (extras) => ng(['test', '--watch=false', ...extras]),
  typecheck: () => tsc('tsconfig.app.json') || tsc('tsconfig.spec.json'),
  ng: (extras) => ng(extras),
};

function principal() {
  const [comando, ...extras] = process.argv.slice(2);
  if (!Object.hasOwn(comandos, comando || '')) {
    console.error('Uso: node local/interface.js build | test | typecheck | ng <argumentos>');
    return 1;
  }
  exigirInstalacao();
  return comandos[comando](extras);
}

if (require.main === module) {
  try {
    process.exitCode = principal();
  } catch (erro) {
    console.error(erro.message);
    process.exitCode = 1;
  }
}

module.exports = { prepararEsbuild };
