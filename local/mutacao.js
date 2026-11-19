'use strict';
/* Defeitos deliberados somente em cópias temporárias. Nenhum arquivo real é editado. */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const RAIZ = path.join(__dirname, '..');
const REPO = 'src/infra/repositorio.js';
const OPS = 'src/application/operacoes.js';
const VAL = 'src/domain/validacao.js';
const mutacao = (id, arquivo, de, para, justificativa = '') => ({ id, arquivo, de, para, justificativa });
const MUTACOES = [
  mutacao('MUT-01', REPO, "operacao.estado === 'CONFIRMADA' || evento.estado === 'PENDENTE'", "false || evento.estado === 'PENDENTE'"),
  mutacao('MUT-02', REPO, 'if (porRequisicao.has(evento.requisicao_id))', 'if (false)'),
  mutacao('MUT-03', REPO, 'if (!produtos.has(movimento.sku))', 'if (false)'),
  mutacao('MUT-04', REPO, 'evento.referencia_id !== linha[chave] ||', 'false ||'),
  mutacao('MUT-05', REPO, "['PENDENTE', 'PENDENTE_RECONCILIACAO', 'CONFIRMADA', 'REJEITADA'].indexOf(evento.estado) === -1", 'false'),
  mutacao('MUT-06', REPO, "['CADASTRO_PRODUTO', 'ENTRADA', 'CADASTRO_FORNECEDOR'].indexOf(evento.tipo) === -1", 'false'),
  mutacao('MUT-07', 'local/armazenamento-jsonl.js', 'fs.fsyncSync(descritor);', '/* sem fsync */'),
  mutacao('MUT-08', OPS, "if (!operacao || operacao.estado !== 'CONFIRMADA')", 'if (false)'),
  mutacao('MUT-09', OPS, 'if (estadoFinal.pendentes.length)', 'if (false)'),
  mutacao('MUT-10', REPO, 'PULSO.movimento.TIPOS.indexOf(movimento.tipo) === -1', 'false', 'A reconstrução canônica da intenção já recusa tipo divergente antes da soma.'),
  mutacao('MUT-11', REPO, 'movimento.delta_unidades === 0', 'false', 'A validação de domínio da intenção já recusa delta zero antes da soma.'),
  mutacao('MUT-12', VAL, 'Number.isSafeInteger(valor)', 'Number.isInteger(valor)'),
  mutacao('MUT-13', VAL, 'valor > 0', 'valor >= 0'),
  mutacao('MUT-14', VAL, 'valor >= 0', 'true'),
  mutacao('MUT-15', VAL, 'PADRAO_SKU.test(sku)', 'true'),
  mutacao('MUT-16', VAL, 'PADRAO_REQUISICAO.test(requisicaoId)', 'true'),
  mutacao('MUT-17', VAL, 'INICIO_DE_FORMULA.test(valor)', 'false'),
  mutacao('MUT-18', VAL, 'CONTROLE.test(valor)', 'false'),
  mutacao('MUT-19', VAL, 'valor !== valor.trim()', 'false'),
  mutacao('MUT-20', 'src/domain/produto.js', 'request.estoqueAlvo < request.estoqueMinimo', 'false'),
  mutacao('MUT-21', 'src/domain/produto.js', "typeof ativo !== 'boolean'", 'false'),
  mutacao('MUT-22', REPO, 'if (vistos.has(linha[chave]))', 'if (false)'),
  mutacao('MUT-23', REPO, "if (operacao.estado !== 'CONFIRMADA') pendentes.push(operacao);", 'if (false) pendentes.push(operacao);'),
  mutacao('MUT-24', REPO, 'else if (!presentes.has(operacao.operacaoId))', 'else if (false)'),
  mutacao('MUT-25', REPO, "operacoes.get(linha.operacao_id).estado === 'CONFIRMADA'", 'true'),
  mutacao('MUT-26', REPO, 'evento.assinatura !== JSON.stringify(normalizado.dados)', 'false'),
  mutacao('MUT-27', REPO, 'evento.tipo !== operacao.tipo', 'false'),
  mutacao('MUT-28', REPO, 'evento.requisicao_id !== operacao.requisicaoId', 'false'),
  mutacao('MUT-29', REPO, 'evento.referencia_id !== operacao.linha[chave]', 'false'),
  mutacao('MUT-30', REPO, 'evento.tentativas < 1', 'false'),
  mutacao('MUT-31', REPO, 'if (!PULSO.validacao.inteiroSeguro(saldo))', 'if (false)'),
  mutacao('MUT-32', REPO, 'gravadas.length !== 1 || esquema.canonica(tabela, gravadas[0]) !== esquema.canonica(tabela, linha)', 'gravadas.length !== 1'),
  mutacao('MUT-33', 'src/application/casos-de-uso.js', "if (!produto.ativo)", 'if (false)'),
  mutacao('MUT-34', 'src/application/casos-de-uso.js', 'if (estado.produtos.has(dados.sku))', 'if (false)'),
  mutacao('MUT-35', 'src/application/casos-de-uso.js', 'if (!PULSO.validacao.inteiroNaoNegativo(saldoResultante))', 'if (false)'),
  mutacao('MUT-36', OPS, 'anterior.assinatura !== assinatura', 'false'),
  mutacao('MUT-37', OPS, 'if (anterior.tipo !== def.tipo ||', 'if (false ||', 'Os tipos têm dados canônicos distintos; a assinatura já recusa esse conflito.'),
  mutacao('MUT-38', 'src/domain/estoque.js', 'movimento.sku === sku ? saldo + movimento.delta_unidades : saldo', 'saldo + movimento.delta_unidades'),
  mutacao('MUT-39', 'src/domain/estoque.js', 'saldo += movimento.delta_unidades;', 'saldo = movimento.delta_unidades;'),
  mutacao('MUT-40', 'local/armazenamento-jsonl.js', "if (!conteudo.endsWith('\\n'))", 'if (false)'),
  mutacao('MUT-41', OPS, 'podeMarcarInterrupcao = false;\n      ctx.repositorio.anexarVerificado(LOG', 'podeMarcarInterrupcao = true;\n      ctx.repositorio.anexarVerificado(LOG'),
  mutacao('MUT-42', REPO, "if (esquema.canonica(tabela, linha) !== esquema.canonica(tabela, operacao.linha))", 'if (false)'),
];

function executarMutacao(m) {
  const pasta = fs.mkdtempSync(path.join(os.tmpdir(), 'pulso-mutacao-'));
  try {
    for (const nome of ['src', 'local', 'tests', 'fixtures', 'package.json']) {
      fs.cpSync(path.join(RAIZ, nome), path.join(pasta, nome), { recursive: true });
    }
    const alvo = path.join(pasta, m.arquivo);
    const codigo = fs.readFileSync(alvo, 'utf8');
    if (!codigo.includes(m.de)) return { id: m.id, estado: 'ALVO_AUSENTE', justificativa: '' };
    fs.writeFileSync(alvo, codigo.replace(m.de, m.para));
    const sintaxe = spawnSync(process.execPath, ['--check', alvo], { encoding: 'utf8' });
    if (sintaxe.status !== 0) return { id: m.id, estado: 'MUTACAO_INVALIDA', justificativa: sintaxe.stderr };
    const teste = spawnSync(process.execPath, ['--test', 'tests/*.test.js'], { cwd: pasta, encoding: 'utf8', timeout: 30000, maxBuffer: 4 * 1024 * 1024 });
    if (teste.error || teste.signal) return { id: m.id, estado: 'ERRO_EXECUCAO', justificativa: String(teste.error || teste.signal) };
    return { id: m.id, estado: teste.status === 0 ? 'SOBREVIVEU' : 'DETECTADA', justificativa: teste.status === 0 ? m.justificativa : '' };
  } finally {
    fs.rmSync(pasta, { recursive: true, force: true });
  }
}

function principal() {
  const filtro = process.argv[2];
  const selecionadas = filtro ? MUTACOES.filter((m) => m.id === filtro) : MUTACOES;
  if (!selecionadas.length) throw new Error('Mutação desconhecida.');
  const resultados = selecionadas.map((m) => {
    const r = executarMutacao(m);
    console.log(`${r.id}: ${r.estado}${r.justificativa ? ' — ' + r.justificativa : ''}`);
    return r;
  });
  console.log(JSON.stringify({ total: resultados.length, detectadas: resultados.filter((r) => r.estado === 'DETECTADA').length,
    sobreviventes: resultados.filter((r) => r.estado === 'SOBREVIVEU'), erros: resultados.filter((r) => !['DETECTADA', 'SOBREVIVEU'].includes(r.estado)) }, null, 2));
  process.exitCode = resultados.some((r) => r.estado !== 'DETECTADA' && !(r.estado === 'SOBREVIVEU' && r.justificativa)) ? 1 : 0;
}
if (require.main === module) principal();
module.exports = { MUTACOES, executarMutacao };
