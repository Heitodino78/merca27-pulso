/*
 * Ponto de montagem do núcleo. Recebe as portas do ambiente:
 *   armazenamento: { ler(tabela), anexar(tabela, linha) }
 *   lock:          { executar(funcao) }
 *   relogio:       () => instante ISO 8601 em UTC
 *   gerarId:       (prefixo) => identificador único
 */
/** @type {PulsoNucleo} */
var PULSO = PULSO || /** @type {PulsoNucleo} */ ({});

/** @param {PortasPulso} portas */
function pulsoCriar(portas) {
  const ctx = {
    repositorio: PULSO.repositorio.criar(portas.armazenamento),
    lock: portas.lock,
    relogio: portas.relogio,
    gerarId: portas.gerarId,
  };
  return {
    consultarReposicao: function () { return PULSO.casosDeUso.consultarReposicao(ctx); },
    registrarSaldoInicial: function (request) { return PULSO.casosDeUso.registrarSaldoInicial(ctx, request); },
    registrarPerda: function (request) { return PULSO.casosDeUso.registrarPerda(ctx, request); },
    ajustarPorContagem: function (request) { return PULSO.casosDeUso.ajustarPorContagem(ctx, request); },
    alterarProduto: function (request) { return PULSO.casosDeUso.alterarProduto(ctx, request); },
    desativarProduto: function (request) { return PULSO.casosDeUso.desativarProduto(ctx, request); },
    reativarProduto: function (request) { return PULSO.casosDeUso.reativarProduto(ctx, request); },
    consultarHistoricoProduto: function (request) { return PULSO.casosDeUso.consultarHistoricoProduto(ctx, request); },
    cadastrarFornecedor: function (request) { return PULSO.casosDeUso.cadastrarFornecedor(ctx, request); },
    listarFornecedores: function () { return PULSO.casosDeUso.listarFornecedores(ctx); },
    cadastrarProduto: /** @param {PedidoCadastro} request */ function (request) { return PULSO.casosDeUso.cadastrarProduto(ctx, request); },
    registrarEntrada: /** @param {PedidoEntrada} request */ function (request) { return PULSO.casosDeUso.registrarEntrada(ctx, request); },
    consultarEstoque: function (request) { return PULSO.casosDeUso.consultarEstoque(ctx, request); },
    listarProdutos: function () { return PULSO.casosDeUso.listarProdutos(ctx); },
    reconciliarPendencias: function () { return PULSO.operacoes.reconciliar(ctx); },
  };
}
PULSO.criar = pulsoCriar;
