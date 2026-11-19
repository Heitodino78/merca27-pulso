/* Regras puras de saldo: o saldo é sempre derivado dos movimentos recebidos. */
/** @type {PulsoNucleo} */
var PULSO = PULSO || /** @type {PulsoNucleo} */ ({});

function pulsoCriarEstoque() {
  /** @param {LinhaMovimento[]} movimentos @param {string} sku @returns {number} */
  function calcularSaldo(movimentos, sku) {
    return movimentos.reduce(function (saldo, movimento) {
      return movimento.sku === sku ? saldo + movimento.delta_unidades : saldo;
    }, 0);
  }

  /** @param {LinhaMovimento[]} movimentos @param {string} sku */
  function historicoComSaldo(movimentos, sku) {
    let saldo = 0;
    return movimentos
      .filter(function (movimento) { return movimento.sku === sku; })
      .map(function (movimento) {
        saldo += movimento.delta_unidades;
        return {
          movimentoId: movimento.movimento_id,
          operacaoId: movimento.operacao_id,
          tipo: movimento.tipo,
          deltaUnidades: movimento.delta_unidades,
          saldoApos: saldo,
          motivo: movimento.motivo,
          referenciaId: movimento.referencia_id,
          registradoEm: movimento.registrado_em,
          operadorSimulado: movimento.operador_simulado,
          custoUnitCentavos: movimento.custo_unit_centavos,
          fornecedorId: movimento.fornecedor_id,
          categoriaPerda: movimento.categoria_perda,
          saldoAnterior: movimento.saldo_anterior, saldoNovo: movimento.saldo_novo,
        };
      });
  }

  return { calcularSaldo: calcularSaldo, historicoComSaldo: historicoComSaldo };
}
PULSO.estoque = pulsoCriarEstoque();
