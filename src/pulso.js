/*
 * Ponto de montagem do núcleo. Recebe as portas do ambiente:
 *   armazenamento: { ler(tabela), anexar(tabela, linha) }
 *   lock:          { executar(funcao) }
 *   relogio:       () => instante ISO 8601 em UTC
 *   gerarId:       (prefixo) => identificador único
 */
var PULSO = PULSO || {};

PULSO.criar = function (portas) {
  const ctx = {
    repositorio: PULSO.repositorio.criar(portas.armazenamento),
    lock: portas.lock,
    relogio: portas.relogio,
    gerarId: portas.gerarId,
  };
  return {
    cadastrarProduto: function (request) { return PULSO.casosDeUso.cadastrarProduto(ctx, request); },
    registrarEntrada: function (request) { return PULSO.casosDeUso.registrarEntrada(ctx, request); },
    consultarEstoque: function (request) { return PULSO.casosDeUso.consultarEstoque(ctx, request); },
    listarProdutos: function () { return PULSO.casosDeUso.listarProdutos(ctx); },
    reconciliarPendencias: function () { return PULSO.operacoes.reconciliar(ctx); },
  };
};
