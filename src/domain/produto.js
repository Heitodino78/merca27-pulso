/* Modelo de Produto: validação do cadastro e construção do registro. */
var PULSO = PULSO || {};

PULSO.produto = (function () {
  const CATEGORIAS = ['BEBIDAS', 'MERCEARIA', 'LATICINIOS', 'SNACKS', 'HIGIENE', 'LIMPEZA'];
  const UNIDADES = ['UN'];
  const PADRAO_FORNECEDOR = /^FOR-\d{3}$/;
  const CAMPOS = [
    'requisicaoId', 'sku', 'nome', 'categoria', 'unidade', 'precoVendaCentavos',
    'custoRefCentavos', 'estoqueMinimo', 'estoqueAlvo', 'fornecedorId', 'ativo',
  ];

  function invalido(mensagem) {
    return PULSO.erros.falha('DADOS_INVALIDOS', mensagem);
  }

  function normalizarCadastro(request) {
    const v = PULSO.validacao;
    const extras = v.camposDesconhecidos(request, CAMPOS);
    if (extras.length) return invalido('Campo não aceito no cadastro: ' + extras.join(', ') + '.');

    if (!v.skuValido(request.sku)) {
      return PULSO.erros.falha('SKU_INVALIDO', 'Informe o SKU no formato MER-001.');
    }
    const problemaNome = v.problemaTexto(request.nome, 'Nome', 3, 120);
    if (problemaNome) return invalido(problemaNome);
    if (CATEGORIAS.indexOf(request.categoria) === -1) {
      return invalido('Categoria inválida. Use: ' + CATEGORIAS.join(', ') + '.');
    }
    const unidade = request.unidade === undefined ? 'UN' : request.unidade;
    if (UNIDADES.indexOf(unidade) === -1) return invalido('Unidade inválida. Use UN.');
    if (!v.inteiroNaoNegativo(request.precoVendaCentavos)) {
      return invalido('Preço de venda deve ser um inteiro em centavos, zero ou maior.');
    }
    if (!v.inteiroNaoNegativo(request.custoRefCentavos)) {
      return invalido('Custo de referência deve ser um inteiro em centavos, zero ou maior.');
    }
    if (!v.inteiroNaoNegativo(request.estoqueMinimo)) {
      return invalido('Estoque mínimo deve ser um inteiro, zero ou maior.');
    }
    if (!v.inteiroNaoNegativo(request.estoqueAlvo) || request.estoqueAlvo < request.estoqueMinimo) {
      return invalido('Estoque alvo deve ser um inteiro maior ou igual ao estoque mínimo.');
    }
    const fornecedorId = request.fornecedorId === undefined ? null : request.fornecedorId;
    if (fornecedorId !== null && !(typeof fornecedorId === 'string' && PADRAO_FORNECEDOR.test(fornecedorId))) {
      return invalido('Fornecedor deve estar no formato FOR-001.');
    }
    const ativo = request.ativo === undefined ? true : request.ativo;
    if (typeof ativo !== 'boolean') return invalido('Ativo deve ser verdadeiro ou falso.');

    return {
      ok: true,
      dados: {
        sku: request.sku,
        nome: request.nome,
        categoria: request.categoria,
        unidade: unidade,
        precoVendaCentavos: request.precoVendaCentavos,
        custoRefCentavos: request.custoRefCentavos,
        estoqueMinimo: request.estoqueMinimo,
        estoqueAlvo: request.estoqueAlvo,
        fornecedorId: fornecedorId,
        ativo: ativo,
      },
    };
  }

  function construirLinha(dados, operacaoId, agora) {
    return {
      sku: dados.sku,
      nome: dados.nome,
      categoria_id: dados.categoria,
      unidade: dados.unidade,
      preco_venda_centavos: dados.precoVendaCentavos,
      custo_ref_centavos: dados.custoRefCentavos,
      estoque_minimo: dados.estoqueMinimo,
      estoque_alvo: dados.estoqueAlvo,
      fornecedor_id: dados.fornecedorId,
      ativo: dados.ativo,
      criado_em: agora,
      atualizado_em: agora,
      operacao_id: operacaoId,
    };
  }

  return { CATEGORIAS: CATEGORIAS, normalizarCadastro: normalizarCadastro, construirLinha: construirLinha };
})();
