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
const NOVA = 'src/app/paginas/venda-nova.ts';
const VENDAS = 'src/app/paginas/vendas.ts';
const PERIODO = 'src/app/nucleo/periodo.ts';
const KPI = 'src/app/ui/kpi.ts';
const GRAFICO = 'src/app/ui/grafico-serie.ts';
const PALETA = 'src/app/ui/paleta-comandos.ts';
const VISAO = 'src/app/paginas/visao-geral.ts';

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
  m('MUI-14', NOVA, 'revisando() || controle.enviando() || !!confirmada()', 'revisando() || controle.enviando()'),
  m('MUI-15', NOVA, 'subtotal: preco * i.quantidade', 'subtotal: preco'),
  m('MUI-16', NOVA, 'quantidade: paraInteiro(i.quantidade) ?? Number.NaN', 'quantidade: 1'),
  m('MUI-17', NOVA, 'this.revisando.set(true);', 'this.revisando.set(true); void this.confirmar();'),
  m('MUI-18', NOVA, "return e.fase === 'sucesso' ? e.resposta : null;", "return e.fase === 'sucesso' && e.resposta.totalCentavos === 0 ? e.resposta : null;"),
  m('MUI-19', VENDAS, "if (this.controle.estado().fase === 'sucesso') untracked", "if (this.controle.estado().fase === 'incerto') untracked"),
  m('MUI-20', NOVA, '.filter((p) => p.ativo)', '.filter(() => true)'),
  m('MUI-21', VENDAS, ' || v.requisicaoId.toUpperCase().includes(termo)', ''),
  m('MUI-22', NOVA, 'formaPagamentoFicticia: v.pagamento,', "formaPagamentoFicticia: 'DINHEIRO',"),
  m('MUI-23', VENDAS, "protected readonly motivo = new FormControl('', { nonNullable: true, validators: [obrigatorio] });", "protected readonly motivo = new FormControl('', { nonNullable: true });"),
  m('MUI-24', CLASS, ", 'VENDA_JA_ESTORNADA'", ''),
  m('MUI-25', API, "this.gravar<RespostaEstorno>('estornarVenda', p)", "this.gravar<RespostaEstorno>('confirmarVenda', p)"),
  m('MUI-26', 'src/app/ui/campo.ts', ", '[attr.id]': 'null'", ''),
  // Fase 3: visão geral, período, gráfico, paleta e filtro de vendas.
  m('MUI-27', PERIODO, 'return { desde: inicioDoDia(p.de), ate: inicioDoDia(somarDias(p.ate, 1)) };', 'return { desde: inicioDoDia(p.de), ate: inicioDoDia(p.ate) };'),
  m('MUI-28', PERIODO, 'const DESLOCAMENTO_MS = 3 * 60 * 60 * 1000;', 'const DESLOCAMENTO_MS = 0;'),
  m('MUI-29', KPI, "if (valor === null || !Number.isFinite(valor)) return 'N/D';", "if (valor === null || !Number.isFinite(valor)) return formatarBRL(0);"),
  m('MUI-30', API, "this.consultar<Indicadores>('consultarIndicadores', { desde, ate })", "this.consultar<Indicadores>('consultarIndicadores', { desde, ate: desde })"),
  m('MUI-31', VISAO, ' [consulta]="filtroVendas()"', ''),
  m('MUI-32', GRAFICO, 'ArrowRight: atual + 1, ArrowLeft: atual - 1', 'ArrowRight: atual + 1, ArrowLeft: atual + 1'),
  m('MUI-33', PALETA, 'if (item) this.ir(item);', ''),
  m('MUI-34', PALETA, ".normalize('NFD').replace(/[\\u0300-\\u036f]/g, '')", ''),
  m('MUI-35', VENDAS, 'return this.api.listarVendas(f ? { desde: f.desde, ate: f.ate, limite: 500 } : {});', 'return this.api.listarVendas({});'),
  m('MUI-36', VISAO, 'if (!problema) void this.mudarPeriodo(p);', 'void this.mudarPeriodo(p);'),
  m('MUI-37', VISAO, 'await this.carga.carregar(true);', 'await this.carga.carregar();'),
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
      timeout: 180000, maxBuffer: 4 * 1024 * 1024,
    });
    if (r.error || r.signal) return 'ERRO_EXECUCAO';
    if (r.status === 0) return 'SOBREVIVEU';
    // O Vitest colore o resumo mesmo com FORCE_COLOR=0; sem remover o ANSI, toda detecção virava erro.
    const saida = (r.stdout + r.stderr).replace(/\x1b\[[0-9;]*m/g, '');
    // Falha de compilação não prova que os testes detectam o defeito.
    if (/bundle generation failed/i.test(saida)) return 'ERRO_COMPILACAO';
    if (!/Tests\s+\d+ failed/.test(saida)) return 'ERRO_EXECUCAO';
    return 'DETECTADA';
  } finally {
    fs.rmSync(COPIA, { recursive: true, force: true });
  }
}

const filtro = process.argv[2];
if (filtro === '--verificar-alvos') {
  // Confere, sem rodar testes, que cada defeito encontra exatamente um alvo no código atual.
  const problemas = MUTACOES.filter((x) => fs.readFileSync(path.join(DIR, x.arquivo), 'utf8').split(x.de).length !== 2).map((x) => x.id);
  console.log(problemas.length ? `Alvos ausentes ou repetidos: ${problemas.join(', ')}` : `${MUTACOES.length} alvos encontrados uma única vez.`);
  process.exit(problemas.length ? 1 : 0);
}
if (filtro && !MUTACOES.some((x) => x.id === filtro)) throw new Error('Mutação de interface desconhecida.');
const esbuild = prepararEsbuild();
const resultados = (filtro ? MUTACOES.filter((x) => x.id === filtro) : MUTACOES).map((mutacao) => {
  const estado = executar(mutacao, esbuild);
  console.log(`${mutacao.id}: ${estado}  (${mutacao.arquivo})`);
  return { id: mutacao.id, estado };
});
const ruins = resultados.filter((r) => r.estado !== 'DETECTADA');
console.log(JSON.stringify({ total: resultados.length, detectadas: resultados.length - ruins.length, problemas: ruins }, null, 2));
process.exitCode = ruins.length ? 1 : 0;
