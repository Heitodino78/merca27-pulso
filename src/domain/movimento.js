/* Modelo de Movimento de estoque. Nesta fase apenas ENTRADA é emitida. */
/** @type {PulsoNucleo} */
var PULSO = PULSO || /** @type {PulsoNucleo} */ ({});

function pulsoCriarMovimento() {
  const TIPOS = ['SALDO_INICIAL', 'ENTRADA', 'VENDA', 'PERDA', 'AJUSTE', 'ESTORNO'];
  const OPERADOR_PADRAO = 'OPERADOR-DEMO';
  const PADRAO_OPERADOR = /^[A-Z0-9][A-Z0-9-]{2,39}$/;
  const CAMPOS = ['requisicaoId', 'sku', 'quantidade', 'referenciaFornecedor', 'motivo', 'operadorSimulado'];

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
    };
  }

  return { TIPOS: TIPOS, normalizarEntrada: normalizarEntrada, construirEntrada: construirEntrada };
}
PULSO.movimento = pulsoCriarMovimento();
