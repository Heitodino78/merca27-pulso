/** Fornecedores inteiramente fictícios; nenhum dado de contato. */
/** @type {PulsoNucleo} */
var PULSO = PULSO || /** @type {PulsoNucleo} */ ({});
function pulsoCriarFornecedor() {
  function idValido(id) { return typeof id === 'string' && /^FOR-\d{3}$/.test(id); }
  /** @param {PedidoFornecedor} request */
  function normalizarCadastro(request) {
    const v = PULSO.validacao;
    const extras = v.camposDesconhecidos(request, ['requisicaoId', 'fornecedorId', 'nomeFicticio', 'categoriaPrincipal', 'prazoEstimadoDias', 'ativo']);
    const problema = v.problemaTexto(request.nomeFicticio, 'Nome fictício', 3, 120);
    if (extras.length || !idValido(request.fornecedorId) || problema ||
        PULSO.produto.CATEGORIAS.indexOf(request.categoriaPrincipal) === -1 ||
        !v.inteiroNaoNegativo(request.prazoEstimadoDias) ||
        (request.ativo !== undefined && typeof request.ativo !== 'boolean')) {
      return PULSO.erros.falha('DADOS_INVALIDOS', problema || 'Cadastro de fornecedor inválido. Informe FOR-001, categoria, prazo inteiro e apenas os campos permitidos.');
    }
    return { ok: true, dados: { fornecedorId: request.fornecedorId, nomeFicticio: request.nomeFicticio,
      categoriaPrincipal: request.categoriaPrincipal, prazoEstimadoDias: request.prazoEstimadoDias,
      ativo: request.ativo === undefined ? true : request.ativo } };
  }
  /** @param {PedidoFornecedor} dados @returns {LinhaFornecedor} */
  function construirLinha(dados, operacaoId, agora) {
    return { fornecedor_id: dados.fornecedorId, nome_ficticio: dados.nomeFicticio, categoria_principal: dados.categoriaPrincipal,
      prazo_estimado_dias: dados.prazoEstimadoDias, ativo: dados.ativo, criado_em: agora, operacao_id: operacaoId };
  }
  return { idValido: idValido, normalizarCadastro: normalizarCadastro, construirLinha: construirLinha };
}
PULSO.fornecedor = pulsoCriarFornecedor();
