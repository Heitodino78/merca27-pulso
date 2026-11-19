/*
 * Venda com vários itens e estorno total (Fase 2). Fonte única das regras de formato e da
 * construção dos registros: os casos de uso gravam com estas funções e o repositório
 * reconstrói com elas para conferir cada intenção.
 */
/** @type {PulsoNucleo} */
var PULSO = PULSO || /** @type {PulsoNucleo} */ ({});

function pulsoCriarVenda() {
  const FORMAS_PAGAMENTO = ['DINHEIRO', 'PIX', 'CARTAO'];
  const LIMITE_ITENS = 50;
  const OPERADOR_PADRAO = 'OPERADOR-DEMO';
  const PADRAO_OPERADOR = /^[A-Z0-9][A-Z0-9-]{2,39}$/;
  const PADRAO_VENDA = /^VEN-[A-Za-z0-9._:-]{1,90}$/;

  function operadorDe(request) {
    const operador = request.operadorSimulado === undefined ? OPERADOR_PADRAO : request.operadorSimulado;
    return typeof operador === 'string' && PADRAO_OPERADOR.test(operador) ? operador : null;
  }

  /**
   * Itens ordenados por SKU: a mesma venda em outra ordem é a mesma requisição.
   * SKU repetido é recusado, como na contagem (D-055).
   * @param {PedidoVenda} request
   */
  function normalizarVenda(request) {
    const v = PULSO.validacao;
    const falha = PULSO.erros.falha;
    if (!v.eObjeto(request) || v.camposDesconhecidos(request, ['requisicaoId', 'itens', 'formaPagamentoFicticia', 'observacao', 'operadorSimulado']).length) {
      return falha('DADOS_INVALIDOS', 'Campo não aceito na venda.');
    }
    if (!Array.isArray(request.itens) || !request.itens.length || request.itens.length > LIMITE_ITENS) {
      return falha('DADOS_INVALIDOS', 'A venda deve ter de 1 a ' + LIMITE_ITENS + ' itens.');
    }
    const vistos = new Set();
    const itens = [];
    for (let i = 0; i < request.itens.length; i++) {
      const item = request.itens[i];
      if (!v.eObjeto(item) || v.camposDesconhecidos(item, ['sku', 'quantidade']).length) {
        return falha('DADOS_INVALIDOS', 'Cada item da venda deve ter apenas sku e quantidade.');
      }
      if (!v.skuValido(item.sku)) return falha('SKU_INVALIDO', 'Informe o SKU no formato MER-001.');
      if (!v.inteiroPositivo(item.quantidade)) {
        return falha('QTD_INVALIDA', 'A quantidade de ' + item.sku + ' deve ser um número inteiro maior que zero.');
      }
      if (vistos.has(item.sku)) return falha('DADOS_INVALIDOS', 'O SKU ' + item.sku + ' aparece mais de uma vez na venda. Informe a quantidade total em um único item.');
      vistos.add(item.sku);
      itens.push({ sku: item.sku, quantidade: item.quantidade });
    }
    itens.sort(function (a, b) { return a.sku < b.sku ? -1 : 1; });
    if (FORMAS_PAGAMENTO.indexOf(request.formaPagamentoFicticia) === -1) {
      return falha('DADOS_INVALIDOS', 'Forma de pagamento fictícia deve ser DINHEIRO, PIX ou CARTAO.');
    }
    const observacao = request.observacao === undefined || request.observacao === null ? null : request.observacao;
    if (observacao !== null) {
      const problema = v.problemaTexto(observacao, 'Observação', 3, 200);
      if (problema) return falha('DADOS_INVALIDOS', problema);
    }
    const operador = operadorDe(request);
    if (!operador) return falha('DADOS_INVALIDOS', 'Operador simulado inválido.');
    // Mesmos nomes do pedido: a assinatura gravada é renormalizada como pedido na conferência da intenção.
    return { ok: true, dados: { itens: itens, formaPagamentoFicticia: request.formaPagamentoFicticia, observacao: observacao, operadorSimulado: operador } };
  }

  /** @param {PedidoEstorno} request */
  function normalizarEstorno(request) {
    const v = PULSO.validacao;
    const falha = PULSO.erros.falha;
    if (!v.eObjeto(request) || v.camposDesconhecidos(request, ['requisicaoId', 'vendaId', 'motivo', 'operadorSimulado']).length) {
      return falha('DADOS_INVALIDOS', 'Campo não aceito no estorno.');
    }
    if (typeof request.vendaId !== 'string' || !PADRAO_VENDA.test(request.vendaId)) {
      return falha('DADOS_INVALIDOS', 'Informe a venda no formato VEN-...');
    }
    const problema = v.problemaTexto(request.motivo, 'Motivo', 3, 200);
    if (problema) return falha('DADOS_INVALIDOS', problema);
    const operador = operadorDe(request);
    if (!operador) return falha('DADOS_INVALIDOS', 'Operador simulado inválido.');
    return { ok: true, dados: { vendaId: request.vendaId, motivo: request.motivo, operadorSimulado: operador } };
  }

  /**
   * Totais da venda com os valores capturados. null se algum valor sair do intervalo de
   * inteiros exatos: a venda é recusada antes de gravar.
   * @param {{ quantidade: number }[]} itens
   * @param {{ precoUnitCentavos: number, custoUnitCentavos: number }[]} capturas
   */
  function totais(itens, capturas) {
    let total = 0;
    let custo = 0;
    const subtotais = [];
    for (let i = 0; i < itens.length; i++) {
      const subtotal = itens[i].quantidade * capturas[i].precoUnitCentavos;
      const custoItem = itens[i].quantidade * capturas[i].custoUnitCentavos;
      total += subtotal;
      custo += custoItem;
      if (![subtotal, custoItem, total, custo].every(PULSO.validacao.inteiroNaoNegativo)) return null;
      subtotais.push(subtotal);
    }
    return { total: total, custo: custo, subtotais: subtotais };
  }

  /**
   * Registros da venda, nesta ordem: VENDAS, um ITENS_VENDA por item e um movimento VENDA por item.
   * @returns {RegistroOperacao[]}
   */
  function construirRegistrosVenda(dados, operacaoId, requisicaoId, agora, capturas) {
    const soma = totais(dados.itens, capturas);
    if (!soma) throw new Error('Totais fora do intervalo de inteiros exatos.');
    const vendaId = 'VEN-' + operacaoId;
    /** @type {RegistroOperacao[]} */
    const registros = [{ tabela: 'VENDAS', linha: {
      venda_id: vendaId, operacao_id: operacaoId, requisicao_id: requisicaoId, registrado_em: agora,
      forma_pagamento: dados.formaPagamentoFicticia, total_centavos: soma.total, custo_est_centavos: soma.custo,
      observacao: dados.observacao, operador_simulado: dados.operadorSimulado,
    } }];
    dados.itens.forEach(function (item, i) {
      registros.push({ tabela: 'ITENS_VENDA', linha: {
        item_id: 'ITV-' + operacaoId + '-' + (i + 1), venda_id: vendaId, operacao_id: operacaoId, sku: item.sku,
        quantidade: item.quantidade, preco_unit_centavos: capturas[i].precoUnitCentavos,
        custo_unit_est_centavos: capturas[i].custoUnitCentavos, subtotal_centavos: soma.subtotais[i],
      } });
    });
    dados.itens.forEach(function (item, i) {
      registros.push({ tabela: 'MOVIMENTOS_ESTOQUE', linha: {
        movimento_id: 'MOV-' + operacaoId + '-' + (i + 1), operacao_id: operacaoId, sku: item.sku, tipo: 'VENDA',
        delta_unidades: -item.quantidade, motivo: null, referencia_id: vendaId, registrado_em: agora,
        operador_simulado: dados.operadorSimulado, custo_unit_centavos: capturas[i].custoUnitCentavos,
        fornecedor_id: null, categoria_perda: null, saldo_anterior: null, saldo_novo: null,
      } });
    });
    return registros;
  }

  /**
   * Registros do estorno total: ESTORNOS_VENDA e um movimento ESTORNO por item da venda,
   * devolvendo as unidades com o mesmo custo capturado na venda.
   * @param {{ sku: string, quantidade: number, custoUnitCentavos: number }[]} itensDaVenda
   * @returns {RegistroOperacao[]}
   */
  function construirRegistrosEstorno(dados, operacaoId, requisicaoId, agora, itensDaVenda) {
    /** @type {RegistroOperacao[]} */
    const registros = [{ tabela: 'ESTORNOS_VENDA', linha: {
      estorno_id: 'EST-' + operacaoId, venda_id: dados.vendaId, operacao_id: operacaoId, requisicao_id: requisicaoId,
      registrado_em: agora, motivo: dados.motivo, operador_simulado: dados.operadorSimulado,
    } }];
    itensDaVenda.forEach(function (item, i) {
      registros.push({ tabela: 'MOVIMENTOS_ESTOQUE', linha: {
        movimento_id: 'MOV-' + operacaoId + '-' + (i + 1), operacao_id: operacaoId, sku: item.sku, tipo: 'ESTORNO',
        delta_unidades: item.quantidade, motivo: dados.motivo, referencia_id: dados.vendaId, registrado_em: agora,
        operador_simulado: dados.operadorSimulado, custo_unit_centavos: item.custoUnitCentavos,
        fornecedor_id: null, categoria_perda: null, saldo_anterior: null, saldo_novo: null,
      } });
    });
    return registros;
  }

  return {
    FORMAS_PAGAMENTO: FORMAS_PAGAMENTO, LIMITE_ITENS: LIMITE_ITENS,
    normalizarVenda: normalizarVenda, normalizarEstorno: normalizarEstorno, totais: totais,
    construirRegistrosVenda: construirRegistrosVenda, construirRegistrosEstorno: construirRegistrosEstorno,
  };
}
PULSO.venda = pulsoCriarVenda();
