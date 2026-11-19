/** Alterações auditáveis de produto; SKU e unidade permanecem imutáveis. */
/** @type {PulsoNucleo} */
var PULSO = PULSO || /** @type {PulsoNucleo} */ ({});
function pulsoCriarAlteracao() {
  const CAMPOS = ['nome', 'categoria', 'precoVendaCentavos', 'custoRefCentavos', 'estoqueMinimo', 'estoqueAlvo', 'fornecedorId', 'ativo'];
  function canonico(campos) {
    const ordenado = {};
    Object.keys(campos).sort().forEach(function (chave) { ordenado[chave] = campos[chave]; });
    return JSON.stringify(ordenado);
  }
  /** @param {PedidoAlteracao} request */
  function normalizar(request) {
    const v = PULSO.validacao;
    const extras = v.camposDesconhecidos(request, ['requisicaoId', 'sku', 'campos', 'motivo', 'operadorSimulado']);
    if (!v.skuValido(request.sku)) return PULSO.erros.falha('SKU_INVALIDO', 'Informe o SKU no formato MER-001.');
    if (extras.length || !v.eObjeto(request.campos) || !Object.keys(request.campos).length ||
        v.camposDesconhecidos(request.campos, CAMPOS).length || Object.values(request.campos).some(function (valor) { return valor === undefined; })) {
      return PULSO.erros.falha('DADOS_INVALIDOS', 'Informe somente campos alteráveis do produto; SKU e unidade são imutáveis.');
    }
    const problema = v.problemaTexto(request.motivo, 'Motivo', 3, 200);
    const operador = request.operadorSimulado === undefined ? 'OPERADOR-DEMO' : request.operadorSimulado;
    if (problema || typeof operador !== 'string' || !/^[A-Z0-9][A-Z0-9-]{2,39}$/.test(operador)) {
      return PULSO.erros.falha('DADOS_INVALIDOS', problema || 'Operador simulado inválido.');
    }
    return { ok: true, dados: { sku: request.sku, campos: JSON.parse(canonico(request.campos)), motivo: request.motivo, operadorSimulado: operador } };
  }
  function dadosDoProduto(linha) {
    return { sku: linha.sku, nome: linha.nome, categoria: linha.categoria_id, unidade: linha.unidade,
      precoVendaCentavos: linha.preco_venda_centavos, custoRefCentavos: linha.custo_ref_centavos,
      estoqueMinimo: linha.estoque_minimo, estoqueAlvo: linha.estoque_alvo, fornecedorId: linha.fornecedor_id, ativo: linha.ativo };
  }
  function efeito(produto, campos) {
    const atual = dadosDoProduto(produto);
    const mudancas = {};
    Object.keys(campos).sort().forEach(function (chave) { if (campos[chave] !== atual[chave]) mudancas[chave] = campos[chave]; });
    return mudancas;
  }
  function aplicar(produto, campos, agora) {
    const normalizado = PULSO.produto.normalizarCadastro(Object.assign(dadosDoProduto(produto), campos));
    if (!normalizado.ok) return normalizado;
    const linha = PULSO.produto.construirLinha(normalizado.dados, produto.operacao_id, produto.criado_em);
    linha.atualizado_em = agora;
    return { ok: true, produto: linha };
  }
  /** @returns {LinhaAlteracao} */
  function construirLinha(dados, alteracaoId, operacaoId, agora, campos) {
    return { alteracao_id: alteracaoId, operacao_id: operacaoId, sku: dados.sku, campos_json: canonico(campos),
      motivo: dados.motivo, registrado_em: agora, operador_simulado: dados.operadorSimulado };
  }
  return { normalizar: normalizar, canonico: canonico, dadosDoProduto: dadosDoProduto, efeito: efeito, aplicar: aplicar, construirLinha: construirLinha };
}
PULSO.alteracao = pulsoCriarAlteracao();
