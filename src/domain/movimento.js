/* Modelo de Movimento de estoque: saldo inicial, entrada, perda e ajuste por contagem. */
/** @type {PulsoNucleo} */
var PULSO = PULSO || /** @type {PulsoNucleo} */ ({});

function pulsoCriarMovimento() {
  const TIPOS = ['SALDO_INICIAL', 'ENTRADA', 'VENDA', 'PERDA', 'AJUSTE', 'ESTORNO'];
  const OPERADOR_PADRAO = 'OPERADOR-DEMO';
  const LIMITE_ITENS_CONTAGEM = 100;
  const PADRAO_OPERADOR = /^[A-Z0-9][A-Z0-9-]{2,39}$/;
  const CAMPOS = ['requisicaoId', 'sku', 'quantidade', 'referenciaFornecedor', 'motivo', 'operadorSimulado', 'custoUnitCentavos', 'fornecedorId'];

  /** @param {PedidoEntrada} request */
  function normalizarEntrada(request) {
    const v = PULSO.validacao;
    const falha = PULSO.erros.falha;
    const extras = v.camposDesconhecidos(request, CAMPOS);
    if (extras.length) return falha('DADOS_INVALIDOS', 'Campo não aceito na entrada: ' + extras.join(', ') + '.');

    if (!v.skuValido(request.sku)) return falha('SKU_INVALIDO', 'Informe o SKU no formato MER-001.');
    if (!v.inteiroPositivo(request.quantidade)) {
      return falha('QTD_INVALIDA', 'A quantidade deve ser um número inteiro maior que zero.');
    }
    if (!v.inteiroNaoNegativo(request.custoUnitCentavos)) return falha('DADOS_INVALIDOS', 'Custo unitário deve ser um inteiro em centavos, zero ou maior.');
    if (!PULSO.fornecedor.idValido(request.fornecedorId)) return falha('DADOS_INVALIDOS', 'Informe o fornecedor no formato FOR-001.');
    const referencia = request.referenciaFornecedor === undefined ? null : request.referenciaFornecedor;
    if (referencia !== null) {
      const problema = v.problemaTexto(referencia, 'Referência do fornecedor', 1, 40);
      if (problema) return falha('DADOS_INVALIDOS', problema);
    }
    const motivo = request.motivo === undefined ? null : request.motivo;
    if (motivo !== null) {
      const problema = v.problemaTexto(motivo, 'Motivo', 3, 200);
      if (problema) return falha('DADOS_INVALIDOS', problema);
    }
    const operador = request.operadorSimulado === undefined ? OPERADOR_PADRAO : request.operadorSimulado;
    if (typeof operador !== 'string' || !PADRAO_OPERADOR.test(operador)) {
      return falha('DADOS_INVALIDOS', 'Operador simulado deve estar no formato OPERADOR-DEMO.');
    }
    return {
      ok: true,
      dados: {
        sku: request.sku,
        quantidade: request.quantidade,
        referenciaFornecedor: referencia,
        motivo: motivo,
        operadorSimulado: operador,
        custoUnitCentavos: request.custoUnitCentavos,
        fornecedorId: request.fornecedorId,
      },
    };
  }

  /** @param {PedidoEntrada} dados @param {string} movimentoId @param {string} operacaoId @param {string} agora @returns {LinhaMovimento} */
  function construirEntrada(dados, movimentoId, operacaoId, agora) {
    return {
      movimento_id: movimentoId,
      operacao_id: operacaoId,
      sku: dados.sku,
      tipo: 'ENTRADA',
      delta_unidades: dados.quantidade,
      motivo: dados.motivo,
      referencia_id: dados.referenciaFornecedor,
      registrado_em: agora,
      operador_simulado: dados.operadorSimulado,
      custo_unit_centavos: dados.custoUnitCentavos,
      fornecedor_id: dados.fornecedorId,
      categoria_perda: null, saldo_anterior: null, saldo_novo: null,
    };
  }

  function normalizarAdministrativo(request, tipo) {
    const v = PULSO.validacao;
    const permitidos = ['requisicaoId', 'sku', 'motivo', 'operadorSimulado'].concat(tipo === 'AJUSTE'
      ? ['quantidadeContada'] : tipo === 'PERDA' ? ['quantidade', 'categoriaPerda'] : ['quantidade', 'custoUnitCentavos']);
    if (!v.skuValido(request.sku)) return PULSO.erros.falha('SKU_INVALIDO', 'Informe o SKU no formato MER-001.');
    if (v.camposDesconhecidos(request, permitidos).length) return PULSO.erros.falha('DADOS_INVALIDOS', 'Campo não aceito nesta movimentação.');
    if (tipo === 'AJUSTE' ? !v.inteiroNaoNegativo(request.quantidadeContada) : !v.inteiroPositivo(request.quantidade)) {
      return PULSO.erros.falha('QTD_INVALIDA', 'Quantidade deve ser inteira; contagem aceita zero e demais movimentos exigem valor positivo.');
    }
    const problema = v.problemaTexto(request.motivo, 'Motivo', 3, 200);
    const operador = request.operadorSimulado === undefined ? OPERADOR_PADRAO : request.operadorSimulado;
    if (problema || typeof operador !== 'string' || !PADRAO_OPERADOR.test(operador)) return PULSO.erros.falha('DADOS_INVALIDOS', problema || 'Operador simulado inválido.');
    if (tipo === 'SALDO_INICIAL' && !v.inteiroNaoNegativo(request.custoUnitCentavos)) return PULSO.erros.falha('DADOS_INVALIDOS', 'Custo unitário inicial deve ser inteiro em centavos, zero ou maior.');
    if (tipo === 'PERDA' && ['AVARIA', 'VENCIMENTO', 'QUEBRA'].indexOf(request.categoriaPerda) === -1) return PULSO.erros.falha('DADOS_INVALIDOS', 'Categoria da perda deve ser AVARIA, VENCIMENTO ou QUEBRA.');
    /** @type {DadosMovimentoAdministrativo} */
    const dados = { sku: request.sku, motivo: request.motivo, operadorSimulado: operador };
    if (tipo === 'AJUSTE') dados.quantidadeContada = request.quantidadeContada;
    else dados.quantidade = request.quantidade;
    if (tipo === 'SALDO_INICIAL') dados.custoUnitCentavos = request.custoUnitCentavos;
    if (tipo === 'PERDA') dados.categoriaPerda = request.categoriaPerda;
    return { ok: true, dados: dados };
  }

  /** @returns {LinhaMovimento} */
  function construirAdministrativo(dados, tipo, movimentoId, operacaoId, agora, saldoAnterior, custoReferencia) {
    return { movimento_id: movimentoId, operacao_id: operacaoId, sku: dados.sku, tipo: tipo,
      delta_unidades: tipo === 'AJUSTE' ? dados.quantidadeContada - saldoAnterior : tipo === 'PERDA' ? -dados.quantidade : dados.quantidade,
      motivo: dados.motivo, referencia_id: null, registrado_em: agora, operador_simulado: dados.operadorSimulado,
      custo_unit_centavos: tipo === 'SALDO_INICIAL' ? dados.custoUnitCentavos : custoReferencia,
      fornecedor_id: null, categoria_perda: tipo === 'PERDA' ? dados.categoriaPerda : null,
      saldo_anterior: tipo === 'AJUSTE' ? saldoAnterior : null, saldo_novo: tipo === 'AJUSTE' ? dados.quantidadeContada : null };
  }

  /**
   * Contagem de inventário com vários SKUs. Itens ordenados por SKU: a mesma contagem
   * enviada em outra ordem tem a mesma assinatura e é reconhecida como repetição.
   */
  function normalizarContagem(request) {
    const v = PULSO.validacao;
    const falha = PULSO.erros.falha;
    if (!v.eObjeto(request) || v.camposDesconhecidos(request, ['requisicaoId', 'itens', 'motivo', 'operadorSimulado']).length) {
      return falha('DADOS_INVALIDOS', 'Campo não aceito na contagem.');
    }
    if (!Array.isArray(request.itens) || !request.itens.length || request.itens.length > LIMITE_ITENS_CONTAGEM) {
      return falha('DADOS_INVALIDOS', 'Informe de 1 a ' + LIMITE_ITENS_CONTAGEM + ' itens contados.');
    }
    const vistos = new Set();
    const itens = [];
    for (let i = 0; i < request.itens.length; i++) {
      const item = request.itens[i];
      if (!v.eObjeto(item) || v.camposDesconhecidos(item, ['sku', 'quantidadeContada']).length) {
        return falha('DADOS_INVALIDOS', 'Cada item da contagem deve ter apenas sku e quantidadeContada.');
      }
      if (!v.skuValido(item.sku)) return falha('SKU_INVALIDO', 'Informe o SKU no formato MER-001.');
      if (!v.inteiroNaoNegativo(item.quantidadeContada)) {
        return falha('QTD_INVALIDA', 'A quantidade contada de ' + item.sku + ' deve ser inteira, zero ou maior.');
      }
      if (vistos.has(item.sku)) return falha('DADOS_INVALIDOS', 'O SKU ' + item.sku + ' aparece mais de uma vez na contagem.');
      vistos.add(item.sku);
      itens.push({ sku: item.sku, quantidadeContada: item.quantidadeContada });
    }
    itens.sort(function (a, b) { return a.sku < b.sku ? -1 : 1; });
    const problema = v.problemaTexto(request.motivo, 'Motivo', 3, 200);
    const operador = request.operadorSimulado === undefined ? OPERADOR_PADRAO : request.operadorSimulado;
    if (problema || typeof operador !== 'string' || !PADRAO_OPERADOR.test(operador)) {
      return falha('DADOS_INVALIDOS', problema || 'Operador simulado inválido.');
    }
    return { ok: true, dados: { itens: itens, motivo: request.motivo, operadorSimulado: operador } };
  }

  return { TIPOS: TIPOS, normalizarEntrada: normalizarEntrada, construirEntrada: construirEntrada, normalizarContagem: normalizarContagem,
    normalizarAdministrativo: normalizarAdministrativo, construirAdministrativo: construirAdministrativo };
}
PULSO.movimento = pulsoCriarMovimento();
