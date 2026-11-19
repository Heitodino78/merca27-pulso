#!/usr/bin/env node
'use strict';
/*
 * Defeitos deliberados na interface, somente em cópias dentro de interface/.mutacao/
 * (a cópia resolve node_modules da pasta de cima). Nenhum arquivo real é editado.
 * Cada defeito precisa ser detectado pelos testes unitários da interface.
 */
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { prepararEsbuild } = require('./interface');

const DIR = path.join(__dirname, '..', 'interface');
const COPIA = path.join(DIR, '.mutacao');
const ENVIO = 'src/app/nucleo/envio.ts';
const API = 'src/app/nucleo/pulso-api.ts';
const CLASS = 'src/app/nucleo/classificacao.ts';
const DIN = 'src/app/nucleo/dinheiro.ts';
const AVISO = 'src/app/ui/aviso-envio.ts';
const ENTRADA = 'src/app/formularios/form-entrada.ts';

const m = (id, arquivo, de, para) => ({ id, arquivo, de, para });
const MUTACOES = [
  m('MUI-01', ENVIO, 'if (this.enviando()) return Promise.resolve(false);\n    this.tentativa', 'this.tentativa'),
  m('MUI-02', ENVIO, '? { ...this.tentativa, dados }', '? { requisicaoId: this.gerarId(), dados, dadosIncertos: null }'),
  m('MUI-03', ENVIO, 'const dados = this.tentativa.dadosIncertos ?? this.tentativa.dados;', 'const dados = this.tentativa.dados;'),
  m('MUI-04', ENVIO, 'if (tentativa.dadosIncertos === null) this.tentativa = null;', 'this.tentativa = null;'),
  m('MUI-05', ENVIO, "    if (resultado.ok) {\n      this.tentativa = null;", "    if (resultado.ok) {"),
  m('MUI-06', CLASS, "  return 'incerto';\n}", "  return 'nada-gravado';\n}"),
  m('MUI-07', API, "certeza: enviado ? 'incerto' : 'nada-gravado'", "certeza: 'nada-gravado'"),
  m('MUI-08', API, "return { ok: false, erro: respostaMalformada(), certeza: 'incerto' };", "return { ok: true, valor: resposta as T };"),
  m('MUI-09', DIN, "const centavos = Number(inteiros) * 100 + Number(fracao.padEnd(2, '0'));", "const centavos = Number(inteiros) * 100 + Number(fracao);"),
  m('MUI-10', DIN, "if ((m = /^(\\d{1,3}(?:\\.\\d{3})+|\\d+),(\\d{1,2})$/.exec(limpo))", "if ((m = /^(\\d{1,3}(?:\\.\\d{3})+|\\d+),(\\d{1,3})$/.exec(limpo))"),
  m('MUI-11', AVISO, "<button type=\"button\" class=\"botao-principal mt-3\" (click)=\"controle().repetir()\">Repetir com a mesma chave</button>", ""),
  m('MUI-12', ENTRADA, '<fieldset [disabled]="controle.enviando()"', '<fieldset'),
  m('MUI-13', ENTRADA, 'custoUnitCentavos: paraCentavos(v.custo) ?? Number.NaN,', 'custoUnitCentavos: Number(v.custo),'),
];

const COPIAR = ['src', 'angular.json', 'tsconfig.json', 'tsconfig.app.json', 'tsconfig.spec.json', '.postcssrc.json', 'package.json'];

function executar(mutacao, esbuild) {
  fs.rmSync(COPIA, { recursive: true, force: true });
  try {
    for (const nome of COPIAR) fs.cpSync(path.join(DIR, nome), path.join(COPIA, nome), { recursive: true });
    const alvo = path.join(COPIA, mutacao.arquivo);
    const codigo = fs.readFileSync(alvo, 'utf8');
    if (codigo.split(mutacao.de).length !== 2) return 'ALVO_AUSENTE';
    fs.writeFileSync(alvo, codigo.replace(mutacao.de, mutacao.para));
    const r = spawnSync(process.execPath, [path.join(DIR, 'node_modules', '@angular', 'cli', 'bin', 'ng.js'), 'test', '--watch=false'], {
      cwd: COPIA, encoding: 'utf8', env: { ...process.env, ESBUILD_BINARY_PATH: esbuild, NG_CLI_ANALYTICS: 'false', FORCE_COLOR: '0' },
    });
    if (r.status === 0) return 'SOBREVIVEU';
    // Falha de compilação não prova que os testes detectam o defeito.
    if (/bundle generation failed/i.test(r.stdout + r.stderr)) return 'ERRO_COMPILACAO';
    return 'DETECTADA';
  } finally {
    fs.rmSync(COPIA, { recursive: true, force: true });
  }
}

const filtro = process.argv[2];
const esbuild = prepararEsbuild();
const resultados = (filtro ? MUTACOES.filter((x) => x.id === filtro) : MUTACOES).map((mutacao) => {
  const estado = executar(mutacao, esbuild);
  console.log(`${mutacao.id}: ${estado}  (${mutacao.arquivo})`);
  return { id: mutacao.id, estado };
});
const ruins = resultados.filter((r) => r.estado !== 'DETECTADA');
console.log(JSON.stringify({ total: resultados.length, detectadas: resultados.length - ruins.length, problemas: ruins }, null, 2));
process.exitCode = ruins.length ? 1 : 0;
