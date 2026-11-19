/* Modelo de Movimento de estoque. Nesta fase apenas ENTRADA é emitida. */
/** @type {PulsoNucleo} */
var PULSO = PULSO || /** @type {PulsoNucleo} */ ({});

function pulsoCriarMovimento() {
  const TIPOS = ['SALDO_INICIAL', 'ENTRADA', 'VENDA', 'PERDA', 'AJUSTE', 'ESTORNO'];
  const OPERADOR_PADRAO = 'OPERADOR-DEMO';
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

  return { TIPOS: TIPOS, normalizarEntrada: normalizarEntrada, construirEntrada: construirEntrada,
    normalizarAdministrativo: normalizarAdministrativo, construirAdministrativo: construirAdministrativo };
}
PULSO.movimento = pulsoCriarMovimento();
