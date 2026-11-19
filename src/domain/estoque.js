/* Regras puras de saldo: o saldo é sempre derivado dos movimentos recebidos. */
var PULSO = PULSO || {};

PULSO.estoque = (function () {
  function calcularSaldo(movimentos, sku) {
    return movimentos.reduce(function (saldo, movimento) {
      return movimento.sku === sku ? saldo + movimento.delta_unidades : saldo;
    }, 0);
  }

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
        };
      });
  }

  return { calcularSaldo: calcularSaldo, historicoComSaldo: historicoComSaldo };
})();
