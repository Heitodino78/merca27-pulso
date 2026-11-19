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
const CASOS = 'src/application/casos-de-uso.js';
const MOV = 'src/domain/movimento.js';
const ALT = 'src/domain/alteracao.js';
const FORN = 'src/domain/fornecedor.js';
const mutacao = (id, arquivo, de, para, justificativa = '') => ({ id, arquivo, de, para, justificativa });
const MUTACOES = [
  mutacao('MUT-01', REPO, "operacao.estado === 'CONFIRMADA' || evento.estado === 'PENDENTE'", "false || evento.estado === 'PENDENTE'"),
  mutacao('MUT-02', REPO, 'if (porRequisicao.has(evento.requisicao_id))', 'if (false)'),
  mutacao('MUT-03', REPO, "if (!produto) throw inconsistente('movimento '", "if (false) throw inconsistente('movimento '"),
  mutacao('MUT-04', REPO, 'evento.referencia_id !== linha[chave] ||', 'false ||'),
  mutacao('MUT-05', REPO, "['PENDENTE', 'PENDENTE_RECONCILIACAO', 'CONFIRMADA', 'REJEITADA'].indexOf(evento.estado) === -1", 'false'),
  mutacao('MUT-06', REPO, "['CADASTRO_PRODUTO', 'ENTRADA', 'CADASTRO_FORNECEDOR', 'ALTERACAO_PRODUTO', 'SALDO_INICIAL', 'PERDA', 'AJUSTE'].indexOf(evento.tipo) === -1", 'false'),
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
  mutacao('MUT-25', REPO, "if (operacao.estado !== 'CONFIRMADA') return;", 'if (false) return;'),
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
  mutacao('MUT-43', CASOS, "estado.fornecedores.has(dados.fornecedorId) ? PULSO.erros.falha('FORNECEDOR_DUPLICADO'", "false ? PULSO.erros.falha('FORNECEDOR_DUPLICADO'"),
  mutacao('MUT-44', CASOS, "if (!produto) return PULSO.erros.falha('SKU_INEXISTENTE', 'Produto não cadastrado.');\n        const aplicado", "const aplicado"),
  mutacao('MUT-45', CASOS, "if (!aplicado.ok) return aplicado;", ""),
  mutacao('MUT-46', CASOS, "if (aplicado.produto.fornecedor_id && !estado.fornecedores.has(aplicado.produto.fornecedor_id))", "if (false)"),
  mutacao('MUT-47', CASOS, "if (!Object.keys(PULSO.alteracao.efeito(produto, dados.campos)).length)", "if (false)"),
  mutacao('MUT-48', CASOS, "mudarStatus(ctx, request, false)", "mudarStatus(ctx, request, true)"),
  mutacao('MUT-49', CASOS, "reativarProduto: function (ctx, request) { return mudarStatus(ctx, request, true); }", "reativarProduto: function (ctx, request) { return mudarStatus(ctx, request, false); }"),
  mutacao('MUT-50', CASOS, "dados.campoNaoPermitido = true;", ""),
  mutacao('MUT-51', CASOS, "if (!estado.produtos.has(request.sku)) return", "if (false) return"),
  mutacao('MUT-52', CASOS, "if (dados.fornecedorId && !estado.fornecedores.has(dados.fornecedorId))", "if (false)"),
  mutacao('MUT-53', CASOS, "if (!fornecedor) return", "if (false) return"),
  mutacao('MUT-54', CASOS, "if (!fornecedor.ativo) return", "if (false) return"),
  mutacao('MUT-55', CASOS, "tipo === 'SALDO_INICIAL' && estado.movimentos.some(function (m) { return m.sku === dados.sku; })", "false"),
  mutacao('MUT-56', CASOS, "dados.quantidade > saldo", "dados.quantidade >= saldo"),
  mutacao('MUT-57', CASOS, "tipo === 'PERDA' && dados.quantidade > saldo", "false"),
  mutacao('MUT-58', CASOS, "tipo === 'AJUSTE' && dados.quantidadeContada === saldo", "false"),
  mutacao('MUT-59', CASOS, "if (!produto.ativo || saldo > produto.estoque_minimo) return;", "if (saldo > produto.estoque_minimo) return;"),
  mutacao('MUT-60', CASOS, "saldo > produto.estoque_minimo", "saldo >= produto.estoque_minimo"),
  mutacao('MUT-61', CASOS, "sugestaoUnidades: Math.max(0, produto.estoque_alvo - saldo)", "sugestaoUnidades: produto.estoque_alvo"),
  mutacao('MUT-62', CASOS, "itens.sort(function (a, b) { return a.sku.localeCompare(b.sku); });", ""),
  mutacao('MUT-63', CASOS, "estado.produtos.get(dados.sku).custo_ref_centavos)", "0)"),
  mutacao('MUT-64', CASOS, ".sort(function (a, b) { return a.sku < b.sku ? -1 : 1; })", ""),
  mutacao('MUT-65', CASOS, "historico: historico.slice(-limite),", "historico: historico,"),
  mutacao('MUT-66', MOV, "tipo === 'PERDA' ? -dados.quantidade : dados.quantidade", "dados.quantidade"),
  mutacao('MUT-67', MOV, "dados.quantidadeContada - saldoAnterior", "dados.quantidadeContada"),
  mutacao('MUT-68', MOV, "tipo === 'PERDA' && ['AVARIA', 'VENCIMENTO', 'QUEBRA'].indexOf(request.categoriaPerda) === -1", "false"),
  mutacao('MUT-69', MOV, "tipo === 'SALDO_INICIAL' && !v.inteiroNaoNegativo(request.custoUnitCentavos)", "false"),
  mutacao('MUT-70', MOV, "if (!v.inteiroNaoNegativo(request.custoUnitCentavos)) return falha(", "if (false) return falha("),
  mutacao('MUT-71', MOV, "if (!PULSO.fornecedor.idValido(request.fornecedorId))", "if (false)"),
  mutacao('MUT-72', MOV, "if (problema || typeof operador !== 'string' || !PADRAO_OPERADOR.test(operador)) return PULSO.erros.falha('DADOS_INVALIDOS', problema", "if (false) return PULSO.erros.falha('DADOS_INVALIDOS', problema"),
  mutacao('MUT-73', MOV, "saldo_novo: tipo === 'AJUSTE' ? dados.quantidadeContada : null", "saldo_novo: tipo === 'AJUSTE' ? saldoAnterior : null"),
  mutacao('MUT-74', MOV, "if (v.camposDesconhecidos(request, permitidos).length)", "if (false)"),
  mutacao('MUT-75', MOV, "tipo === 'SALDO_INICIAL' ? dados.custoUnitCentavos : custoReferencia", "custoReferencia"),
  mutacao('MUT-76', ALT, "return !valorSimples(valor);", "return valor === undefined;"),
  mutacao('MUT-77', ALT, "v.camposDesconhecidos(request.campos, CAMPOS).length ||", "false ||"),
  mutacao('MUT-78', ALT, "extras.length || !v.eObjeto(request.campos)", "!v.eObjeto(request.campos)"),
  mutacao('MUT-79', ALT, "if (campos[chave] !== atual[chave]) mudancas", "if (true) mudancas"),
  mutacao('MUT-80', ALT, "linha.atualizado_em = agora;", ""),
  mutacao('MUT-81', ALT, "Object.keys(campos).sort().forEach(function (chave) { ordenado", "Object.keys(campos).forEach(function (chave) { ordenado"),
  mutacao('MUT-82', ALT, "if (problema || typeof operador !== 'string' || !/^[A-Z0-9]", "if (typeof operador !== 'string' || !/^[A-Z0-9]"),
  mutacao('MUT-83', REPO, "if (operacao.tipo === 'SALDO_INICIAL' && movimentados.has(linha.sku))", "if (false)"),
  mutacao('MUT-84', REPO, "linha.custo_unit_centavos !== produto.custo_ref_centavos", "false"),
  mutacao('MUT-85', REPO, "(linha.saldo_anterior !== saldo || linha.saldo_novo !== saldo + linha.delta_unidades)", "false"),
  mutacao('MUT-86', REPO, "(!fornecedores.has(linha.fornecedor_id) || !fornecedores.get(linha.fornecedor_id).ativo)", "false"),
  mutacao('MUT-87', REPO, "if (linha.fornecedor_id && !fornecedores.has(linha.fornecedor_id)) throw", "if (false) throw"),
  mutacao('MUT-88', REPO, "if (!produto) throw inconsistente('alteração de produto inexistente');", ""),
  mutacao('MUT-89', REPO, "PULSO.alteracao.canonico(campos) !== linha.campos_json", "false"),
  mutacao('MUT-90', REPO, "if (!resultado.ok || (resultado.produto.fornecedor_id && !fornecedores.has(resultado.produto.fornecedor_id)))", "if (false)"),
  mutacao('MUT-91', REPO, "if (operacao.tipo === 'ENTRADA' && !produto.ativo) throw", "if (false) throw"),
  mutacao('MUT-92', REPO, "conferirOrigem('FORNECEDORES', linhasFornecedores, dobra.operacoes);", ""),
  mutacao('MUT-93', REPO, "conferirOrigem('PRODUTOS_ALTERACOES', linhasAlteracoes, dobra.operacoes);", ""),
  mutacao('MUT-94', REPO, "linhasProdutos.concat(linhasMovimentos, linhasFornecedores, linhasAlteracoes)", "linhasProdutos.concat(linhasMovimentos)"),
  mutacao('MUT-95', REPO, "Object.keys(campos).some(function (c) { return campos[c] !== normalizado.dados.campos[c]; })", "false"),
  mutacao('MUT-96', REPO, "(evento.tipo === 'AJUSTE' && !PULSO.validacao.inteiroNaoNegativo(linha.saldo_anterior))", "false"),
  mutacao('MUT-97', REPO, "return reutilizar && ultimasTabelas.has(tabela) ? ultimasTabelas.get(tabela) : lerAtual(tabela);", "return lerAtual(tabela);"),
  mutacao('MUT-98', OPS, "if (estado.pendentes.length) {\n        try {", "if (false) {\n        try {"),
  mutacao('MUT-99', OPS, "estado = ctx.repositorio.carregarEstado();\n          if (estado.pendentes.length) throw", "if (estado.pendentes.length) throw"),
  mutacao('MUT-100', OPS, "if (estado.pendentes.length) throw new Error('Reconciliação não confirmada.');", ""),
  mutacao('MUT-101', OPS, "concluir(ctx, operacao, true)", "concluir(ctx, operacao, false)"),
  mutacao('MUT-102', OPS, "if (!erro || erro.codigo !== 'DADOS_INCONSISTENTES') return falhaDeLeitura(erro);", "return falhaDeLeitura(erro);"),
  mutacao('MUT-103', OPS, "{ aviso: 'OPERACAO_DUPLICADA' }", "{}"),
  mutacao('MUT-104', OPS, "PULSO.erros.falha('FALHA_LEITURA'", "PULSO.erros.falha('FALHA_GRAVACAO'"),
  mutacao('MUT-105', 'src/infra/esquema.js', "case 'inteiro?': return valor === null || PULSO.validacao.inteiroSeguro(valor);", "case 'inteiro?': return true;"),
  mutacao('MUT-106', FORN, "!v.inteiroNaoNegativo(request.prazoEstimadoDias)", "false"),
  mutacao('MUT-107', FORN, "extras.length || !idValido(request.fornecedorId)", "!idValido(request.fornecedorId)"),
  mutacao('MUT-108', 'src/domain/estoque.js', "custoUnitCentavos: movimento.custo_unit_centavos,", "custoUnitCentavos: null,"),
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
    const teste = spawnSync(process.execPath, ['--test', 'tests/*.test.js'], { cwd: pasta, encoding: 'utf8', timeout: 180000, maxBuffer: 4 * 1024 * 1024 });
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
