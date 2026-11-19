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
const DESP = 'src/application/despacho.js';
const VEN = 'src/domain/venda.js';
const IND = 'src/domain/indicadores.js';
const mutacao = (id, arquivo, de, para, justificativa = '') => ({ id, arquivo, de, para, justificativa });
const MUTACOES = [
  mutacao('MUT-01', REPO, "operacao.estado === 'CONFIRMADA' || evento.estado === 'PENDENTE'", "false || evento.estado === 'PENDENTE'"),
  mutacao('MUT-02', REPO, 'if (porRequisicao.has(evento.requisicao_id))', 'if (false)'),
  mutacao('MUT-03', REPO, "if (!produto) throw inconsistente('movimento '", "if (false) throw inconsistente('movimento '"),
  mutacao('MUT-04', REPO, 'evento.referencia_id !== linha[chave] ||', 'false ||'),
  mutacao('MUT-05', REPO, "['PENDENTE', 'PENDENTE_RECONCILIACAO', 'CONFIRMADA', 'REJEITADA'].indexOf(evento.estado) === -1", 'false'),
  mutacao('MUT-06', REPO, "['CADASTRO_PRODUTO', 'ENTRADA', 'CADASTRO_FORNECEDOR', 'ALTERACAO_PRODUTO', 'SALDO_INICIAL', 'PERDA', 'AJUSTE', 'CONTAGEM_INVENTARIO', 'VENDA', 'ESTORNO_VENDA'].indexOf(evento.tipo) === -1", 'false'),
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
  mutacao('MUT-24', REPO, 'else if (!operacao.registros.every(', 'else if (false && !operacao.registros.every('),
  mutacao('MUT-25', REPO, "if (operacao.estado !== 'CONFIRMADA') return;", 'if (false) return;'),
  mutacao('MUT-26', REPO, 'evento.assinatura !== JSON.stringify(normalizado.dados) ||\n        PULSO.esquema.canonica(payload.tabela', 'false ||\n        PULSO.esquema.canonica(payload.tabela'),
  mutacao('MUT-27', REPO, 'evento.tipo !== operacao.tipo', 'false'),
  mutacao('MUT-28', REPO, 'evento.requisicao_id !== operacao.requisicaoId', 'false'),
  mutacao('MUT-29', REPO, 'evento.referencia_id !== operacao.referenciaId', 'false'),
  mutacao('MUT-30', REPO, 'evento.tentativas < 1', 'false'),
  mutacao('MUT-31', REPO, 'if (!PULSO.validacao.inteiroSeguro(saldo))', 'if (false)'),
  mutacao('MUT-32', REPO, 'gravadas.length !== 1 || esquema.canonica(tabela, gravadas[0]) !== esquema.canonica(tabela, linha)', 'gravadas.length !== 1'),
  mutacao('MUT-33', 'src/application/casos-de-uso.js', "if (!produto.ativo) return PULSO.erros.falha('SKU_INATIVO', 'O SKU ' + dados.sku", "if (false) return PULSO.erros.falha('SKU_INATIVO', 'O SKU ' + dados.sku"),
  mutacao('MUT-34', 'src/application/casos-de-uso.js', 'if (estado.produtos.has(dados.sku))', 'if (false)'),
  mutacao('MUT-35', 'src/application/casos-de-uso.js', 'if (!PULSO.validacao.inteiroNaoNegativo(saldoResultante))', 'if (false)'),
  mutacao('MUT-36', OPS, 'anterior.assinatura !== assinatura', 'false'),
  mutacao('MUT-37', OPS, 'if (anterior.tipo !== def.tipo ||', 'if (false ||', 'Os tipos têm dados canônicos distintos; a assinatura já recusa esse conflito.'),
  mutacao('MUT-38', 'src/domain/estoque.js', 'movimento.sku === sku ? saldo + movimento.delta_unidades : saldo', 'saldo + movimento.delta_unidades'),
  mutacao('MUT-39', 'src/domain/estoque.js', 'saldo += movimento.delta_unidades;', 'saldo = movimento.delta_unidades;'),
  mutacao('MUT-40', 'local/armazenamento-jsonl.js', "if (!conteudo.endsWith('\\n'))", 'if (false)'),
  mutacao('MUT-41', OPS, 'podeMarcarInterrupcao = false;\n      ctx.repositorio.anexarVerificado(LOG', 'podeMarcarInterrupcao = true;\n      ctx.repositorio.anexarVerificado(LOG'),
  mutacao('MUT-42', REPO, "if (esquema.canonica(tabela, linha) !== esquema.canonica(tabela, registro.linha))", 'if (false)'),
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
  mutacao('MUT-83', REPO, "if (tipoMovimento === 'SALDO_INICIAL' && movimentados.has(linha.sku))", "if (false)"),
  mutacao('MUT-84', REPO, "linha.custo_unit_centavos !== produto.custo_ref_centavos", "false"),
  mutacao('MUT-85', REPO, "(linha.saldo_anterior !== saldo || linha.saldo_novo !== saldo + linha.delta_unidades)", "false"),
  mutacao('MUT-86', REPO, "(!fornecedores.has(linha.fornecedor_id) || !fornecedores.get(linha.fornecedor_id).ativo)", "false"),
  mutacao('MUT-87', REPO, "if (linha.fornecedor_id && !fornecedores.has(linha.fornecedor_id)) throw", "if (false) throw"),
  mutacao('MUT-88', REPO, "if (!produto) throw inconsistente('alteração de produto inexistente');", ""),
  mutacao('MUT-89', REPO, "PULSO.alteracao.canonico(campos) !== linha.campos_json", "false"),
  mutacao('MUT-90', REPO, "if (!resultado.ok || (resultado.produto.fornecedor_id && !fornecedores.has(resultado.produto.fornecedor_id)))", "if (false)"),
  mutacao('MUT-91', REPO, "if (tipoMovimento === 'ENTRADA' && !produto.ativo) throw", "if (false) throw"),
  mutacao('MUT-92', REPO, "conferirOrigem('FORNECEDORES', linhasFornecedores, dobra.operacoes);", ""),
  mutacao('MUT-93', REPO, "conferirOrigem('PRODUTOS_ALTERACOES', linhasAlteracoes, dobra.operacoes);", ""),
  mutacao('MUT-94', REPO, "FORNECEDORES: linhasFornecedores, PRODUTOS_ALTERACOES: linhasAlteracoes,", "FORNECEDORES: [], PRODUTOS_ALTERACOES: [],"),
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
  // M-06: despacho da interface.
  mutacao('MUT-109', DESP, "typeof acao !== 'string' || ACOES.indexOf(acao) === -1", "typeof acao !== 'string'"),
  mutacao('MUT-110', DESP, "if (semPedido && pedido !== undefined && pedido !== null) {", "if (false) {"),
  mutacao('MUT-111', DESP, "if (!semPedido && !PULSO.validacao.eObjeto(pedido)) {", "if (false) {"),
  mutacao('MUT-112', DESP, "const ACOES_SEM_PEDIDO = CONSULTAS_SEM_PEDIDO.concat(['reconciliarPendencias']);", "const ACOES_SEM_PEDIDO = CONSULTAS_SEM_PEDIDO.concat(['reconciliarPendencias', 'cadastrarFornecedor']);"),
  mutacao('MUT-113', DESP, "return falha('FALHA_INESPERADA'", "throw erro; return falha('FALHA_INESPERADA'"),
  // M-03: operações com vários registros e CONTAGEM_INVENTARIO.
  mutacao('MUT-114', REPO, "&&\n        TIPOS_LEGADOS.indexOf(evento.tipo) !== -1) registros = [payload];", ") registros = [payload];"),
  mutacao('MUT-115', REPO, 'if (vistos.has(identificador))', 'if (false)',
    'Registro repetido também é recusado pela exigência de um registro antigo, ordem da contagem ou reconstrução canônica e espelho dos itens de venda/estorno; defesa redundante.'),
  mutacao('MUT-116', REPO, 'if (!registros.length || registros.length > LIMITE_REGISTROS)', 'if (registros.length > LIMITE_REGISTROS)'),
  mutacao('MUT-117', REPO, 'else if (!operacao.registros.every(', 'else if (!operacao.registros.some('),
  mutacao('MUT-118', REPO, 'return r.tabela === tabela && r.linha[chave] === linha[chave];', 'return r.tabela === tabela;'),
  mutacao('MUT-119', REPO, "if (registros.length !== 1) throw", "if (false) throw"),
  mutacao('MUT-120', REPO, 'operacao.registros.forEach(function (registro) { reproduzirRegistro(operacao, registro); });', 'reproduzirRegistro(operacao, operacao.registros[0]);'),
  mutacao('MUT-121', REPO, "if (operacao.tipo === 'CONTAGEM_INVENTARIO') conferirItensContados(operacao, produtos, saldos);", ''),
  mutacao('MUT-122', REPO, 'if (evento.referencia_id !== registros[0].linha.movimento_id)', 'if (false)'),
  mutacao('MUT-123', REPO, "if (registro.tabela !== 'MOVIMENTOS_ESTOQUE') throw", 'if (false) throw',
    'Linha de outra tabela é recusada antes pelo esquema dessa tabela e depois pela reconstrução canônica do movimento; a checagem é defesa redundante.'),
  mutacao('MUT-124', REPO, '!ajustados.has(item.sku) && (saldos.get(item.sku) || 0) !== item.quantidadeContada', 'false'),
  mutacao('MUT-125', OPS, 'if (!ctx.repositorio.existe(registro.tabela, registro.linha[chave])) {', '{'),
  mutacao('MUT-126', OPS, 'registros.forEach(function (registro) {\n        ctx.repositorio.anexarVerificado(registro.tabela, registro.linha);\n      });',
    'ctx.repositorio.anexarVerificado(registros[0].tabela, registros[0].linha);'),
  mutacao('MUT-127', OPS, 'operacao.registros.forEach(function (registro) {\n      const chave', 'operacao.registros.slice(0, 1).forEach(function (registro) {\n      const chave'),
  mutacao('MUT-128', MOV, 'if (vistos.has(item.sku)) return falha(', 'if (false) return falha('),
  mutacao('MUT-129', MOV, 'itens.sort(function (a, b) { return a.sku < b.sku ? -1 : 1; });', ''),
  mutacao('MUT-130', MOV, 'request.itens.length > LIMITE_ITENS_CONTAGEM', 'false'),
  mutacao('MUT-131', CASOS, 'if (ausente) return', 'if (false) return'),
  mutacao('MUT-132', CASOS, 'if (!comDiferenca) return', 'if (false) return'),
  mutacao('MUT-133', CASOS, 'if (saldo === item.quantidadeContada) return;', ''),
  mutacao('MUT-134', CASOS, 'const saldo = estado.saldos.get(item.sku) || 0;\n          if (saldo === item.quantidadeContada) return;', 'const saldo = 0;\n          if (saldo === item.quantidadeContada) return;'),
  // Fase 2: vendas e estorno.
  mutacao('MUT-135', VEN, "if (vistos.has(item.sku)) return falha('DADOS_INVALIDOS', 'O SKU ' + item.sku + ' aparece mais de uma vez na venda", "if (false) return falha('DADOS_INVALIDOS', 'O SKU ' + item.sku + ' aparece mais de uma vez na venda"),
  mutacao('MUT-136', VEN, 'itens.sort(function (a, b) { return a.sku < b.sku ? -1 : 1; });', ''),
  mutacao('MUT-137', VEN, 'FORMAS_PAGAMENTO.indexOf(request.formaPagamentoFicticia) === -1', 'false'),
  mutacao('MUT-138', VEN, 'if (!v.inteiroPositivo(item.quantidade))', 'if (!v.inteiroNaoNegativo(item.quantidade))'),
  mutacao('MUT-139', VEN, 'const subtotal = itens[i].quantidade * capturas[i].precoUnitCentavos;', 'const subtotal = capturas[i].precoUnitCentavos;'),
  mutacao('MUT-140', VEN, 'delta_unidades: -item.quantidade,', 'delta_unidades: item.quantidade,'),
  mutacao('MUT-141', VEN, 'operador_simulado: dados.operadorSimulado, custo_unit_centavos: item.custoUnitCentavos,', 'operador_simulado: dados.operadorSimulado, custo_unit_centavos: 0,'),
  mutacao('MUT-142', VEN, 'request.itens.length > LIMITE_ITENS', 'false'),
  mutacao('MUT-143', CASOS, "if (!produto.ativo) return PULSO.erros.falha('SKU_INATIVO', 'O SKU ' + item.sku", "if (false) return PULSO.erros.falha('SKU_INATIVO', 'O SKU ' + item.sku"),
  mutacao('MUT-144', CASOS, 'if (item.quantidade > saldo) {', 'if (item.quantidade > saldo + 1) {'),
  mutacao('MUT-145', CASOS, "if (registro.estorno) return PULSO.erros.falha('VENDA_JA_ESTORNADA'", "if (false) return PULSO.erros.falha('VENDA_JA_ESTORNADA'"),
  mutacao('MUT-146', CASOS, 'return { precoUnitCentavos: produto.preco_venda_centavos, custoUnitCentavos: produto.custo_ref_centavos };', 'return { precoUnitCentavos: produto.preco_venda_centavos, custoUnitCentavos: 0 };'),
  mutacao('MUT-147', CASOS, '.reverse()\n        .slice(', '.slice('),
  mutacao('MUT-148', CASOS, "estado: registro.estorno ? 'ESTORNADA' : 'CONFIRMADA'", "estado: 'CONFIRMADA'"),
  mutacao('MUT-149', CASOS, 'r.venda.registrado_em < consulta.ate', 'r.venda.registrado_em <= consulta.ate'),
  mutacao('MUT-150', REPO, "if (!produto.ativo) throw inconsistente('venda de produto inativo '", "if (false) throw inconsistente('venda de produto inativo '"),
  mutacao('MUT-151', REPO, 'item.preco_unit_centavos !== produto.preco_venda_centavos || item.custo_unit_est_centavos !== produto.custo_ref_centavos', 'false'),
  mutacao('MUT-152', REPO, "if (registro.estorno) throw inconsistente('venda '", "if (false) throw inconsistente('venda '"),
  mutacao('MUT-153', REPO, 'return m.sku !== item.sku || m.delta_unidades !== item.quantidade || m.custo_unit_centavos !== item.custo_unit_est_centavos;', 'return m.sku !== item.sku;'),
  mutacao('MUT-154', REPO, "conferirOrigem('ITENS_VENDA', linhasItens, dobra.operacoes);", ''),
  mutacao('MUT-155', REPO, "if ((saldos.get(item.sku) || 0) < item.quantidade) throw inconsistente('venda acima do saldo", "if (false) throw inconsistente('venda acima do saldo",
    'A conferência de todos os movimentos recusa o mesmo saldo negativo após reproduzir a venda canônica; defesa redundante.'),
  mutacao('MUT-156', REPO, 'if (evento.referencia_id !== /** @type {LinhaVenda} */ (esperados[0].linha).venda_id) throw', 'if (false) throw'),
  mutacao('MUT-157', REPO, "if (linha.tipo === 'VENDA' || linha.tipo === 'ESTORNO') vendas.get(linha.referencia_id).movimentos.push(linha);", ''),
  mutacao('MUT-158', REPO, "if (operacao.tipo === 'ESTORNO_VENDA') conferirEstornoNoEstado(operacao, vendas);", ''),
  mutacao('MUT-159', CASOS, 'if (excedente) return PULSO.erros.falha(', 'if (false) return PULSO.erros.falha('),
  mutacao('MUT-160', CASOS, 'if (!PULSO.venda.totais(dados.itens, capturasDe(estado, dados)))', 'if (false)'),
  mutacao('MUT-161', VEN, 'const custoItem = itens[i].quantidade * capturas[i].custoUnitCentavos;', 'const custoItem = capturas[i].custoUnitCentavos;'),
  mutacao('MUT-162', CASOS, 'consulta.desde >= consulta.ate', 'false'),
  mutacao('MUT-163', CASOS, 'new Date(valor).toISOString() === valor', 'true'),
  // Fase 3: indicadores por período e resumo diário.
  mutacao('MUT-164', IND, 'if (dentro(venda.registrado_em, periodo)) {', 'if (true) {'),
  mutacao('MUT-165', IND, 'if (registro.estorno && dentro(registro.estorno.registrado_em, periodo)) {', 'if (registro.estorno && dentro(venda.registrado_em, periodo)) {'),
  mutacao('MUT-166', IND, 'return instante >= periodo.desde && instante < periodo.ate;', 'return instante >= periodo.desde && instante <= periodo.ate;'),
  mutacao('MUT-167', IND, 'const DESLOCAMENTO_MS = -3 * 60 * 60 * 1000;', 'const DESLOCAMENTO_MS = 0;'),
  mutacao('MUT-168', IND, 'margemPercentual: receitaAposDevolucoes > 0 ?', 'margemPercentual: receitaAposDevolucoes >= 0 ?'),
  mutacao('MUT-169', IND, 'Math.round(vendas.receitaBrutaCentavos / vendas.numero) : null', 'Math.round(vendas.receitaBrutaCentavos / vendas.numero) : 0'),
  mutacao('MUT-170', IND, 'const receitaAposDevolucoes = vendas.receitaBrutaCentavos - devolucoes.valorCentavos;', 'const receitaAposDevolucoes = Math.max(0, vendas.receitaBrutaCentavos - devolucoes.valorCentavos);'),
  mutacao('MUT-171', IND, 'devolucoes.cmvCentavos += venda.custo_est_centavos;', ''),
  mutacao('MUT-172', IND, 'if (!inteiros.every(PULSO.validacao.inteiroSeguro)) return null;', ''),
  mutacao('MUT-173', IND, 'Date.parse(request.ate) - Date.parse(request.desde) > LIMITE_DIAS * DIA_MS', 'false'),
  mutacao('MUT-174', CASOS, 'const indicadores = PULSO.indicadores.agregar(estado, normalizado.dados);\n      if (!indicadores)', 'const indicadores = PULSO.indicadores.agregar(estado, normalizado.dados);\n      if (false)'),
  mutacao('MUT-175', IND, "if (m.tipo === 'PERDA') {", "if (m.tipo === 'PERDA' || m.tipo === 'AJUSTE') {"),
  mutacao('MUT-176', CASOS, 'diaEmAndamento: geradoEm < dados.ate,', 'diaEmAndamento: false,'),
  mutacao('MUT-177', DESP, "    'consultarIndicadores',\n  ];", '  ];'),
  mutacao('MUT-178', IND, 'if (registro.estorno) vendas.estornadasDepois++;', ''),
  mutacao('MUT-179', IND, "if (venda.registrado_em < periodo.desde) devolucoes.deVendasAnteriores++;", ''),
];

function executarMutacao(m) {
  const pasta = fs.mkdtempSync(path.join(os.tmpdir(), 'pulso-mutacao-'));
  try {
    for (const nome of ['src', 'local', 'tests', 'fixtures', 'package.json', 'interface/src']) {
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

/** Confere, sem rodar testes, que cada defeito encontra exatamente um alvo no código atual. */
function verificarAlvos() {
  const problemas = MUTACOES.filter((m) => fs.readFileSync(path.join(RAIZ, m.arquivo), 'utf8').split(m.de).length !== 2)
    .map((m) => m.id);
  console.log(problemas.length ? `Alvos ausentes ou repetidos: ${problemas.join(', ')}` : `${MUTACOES.length} alvos encontrados uma única vez.`);
  process.exitCode = problemas.length ? 1 : 0;
}

function principal() {
  const filtro = process.argv[2];
  if (filtro === '--verificar-alvos') return verificarAlvos();
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
