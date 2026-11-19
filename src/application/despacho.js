/*
 * Ponto único de entrada da interface. O HTML Service (google.script.run) e a
 * pré-visualização local chamam despachar(pulso, acao, pedido); somente as ações
 * desta lista ficam expostas. Nenhuma regra de negócio é decidida aqui.
 */
/** @type {PulsoNucleo} */
var PULSO = PULSO || /** @type {PulsoNucleo} */ ({});

function pulsoCriarDespacho() {
  const CONSULTAS_SEM_PEDIDO = ['listarProdutos', 'listarFornecedores', 'consultarReposicao'];
  const ACOES_SEM_PEDIDO = CONSULTAS_SEM_PEDIDO.concat(['reconciliarPendencias']);
  const ACOES_COM_PEDIDO = [
    'consultarEstoque', 'consultarHistoricoProduto',
    'cadastrarProduto', 'alterarProduto', 'desativarProduto', 'reativarProduto',
    'registrarEntrada', 'registrarSaldoInicial', 'registrarPerda', 'ajustarPorContagem',
  ];
  const ACOES = ACOES_SEM_PEDIDO.concat(ACOES_COM_PEDIDO);

  /**
   * @param {ReturnType<typeof pulsoCriar>} pulso
   * @param {unknown} acao
   * @param {unknown} [pedido]
   */
  function despachar(pulso, acao, pedido) {
    const falha = PULSO.erros.falha;
    if (typeof acao !== 'string' || ACOES.indexOf(acao) === -1) {
      return falha('ACAO_DESCONHECIDA', 'Ação não disponível para a interface. Nada foi alterado.');
    }
    const semPedido = ACOES_SEM_PEDIDO.indexOf(acao) !== -1;
    if (semPedido && pedido !== undefined && pedido !== null) {
      return falha('DADOS_INVALIDOS', 'Esta ação não recebe dados. Nada foi alterado.');
    }
    if (!semPedido && !PULSO.validacao.eObjeto(pedido)) {
      return falha('DADOS_INVALIDOS', 'Envie os dados da ação como objeto. Nada foi alterado.');
    }
    try {
      return semPedido ? pulso[acao]() : pulso[acao](pedido);
    } catch (erro) {
      // Os casos de uso já traduzem as falhas conhecidas. Uma exceção aqui é inesperada
      // e, numa gravação, não permite afirmar se algo foi gravado.
      return falha('FALHA_INESPERADA', 'Erro inesperado. Consulte o estado antes de repetir com o mesmo identificador de requisição.');
    }
  }

  return { ACOES: ACOES, ACOES_SEM_PEDIDO: ACOES_SEM_PEDIDO, despachar: despachar };
}
PULSO.despacho = pulsoCriarDespacho();
