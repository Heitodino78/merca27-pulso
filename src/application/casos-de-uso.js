/* Casos de uso da Fase 00: cadastro, entrada, consulta e reconciliação. */
var PULSO = PULSO || {};

PULSO.casosDeUso = (function () {
  const LIMITE_HISTORICO_PADRAO = 20;

  function cadastrarProduto(ctx, request) {
    return PULSO.operacoes.executar(ctx, {
      tipo: 'CADASTRO_PRODUTO',
      normalizar: PULSO.produto.normalizarCadastro,
      assinatura: function (dados) { return dados; },
      verificar: function (estado, dados) {
        if (estado.produtos.has(dados.sku)) {
          return PULSO.erros.falha('SKU_DUPLICADO', 'O SKU ' + dados.sku + ' já está cadastrado.');
        }
        return null;
      },
      construir: function (dados, operacaoId, agora) {
        return { tabela: 'PRODUTOS', linha: PULSO.produto.construirLinha(dados, operacaoId, agora) };
      },
      responder: function (estado, operacao, situacao) {
        return {
          ok: true,
          duplicada: situacao.duplicada,
          recuperada: situacao.recuperada,
          operacaoId: operacao.operacaoId,
          sku: operacao.linha.sku,
          mensagem: situacao.duplicada
            ? 'Cadastro já realizado por esta requisição; nada foi alterado.'
            : 'Produto ' + operacao.linha.sku + ' cadastrado.',
        };
      },
    }, request);
  }

  function registrarEntrada(ctx, request) {
    return PULSO.operacoes.executar(ctx, {
      tipo: 'ENTRADA',
      normalizar: PULSO.movimento.normalizarEntrada,
      assinatura: function (dados) { return dados; },
      verificar: function (estado, dados) {
        const produto = estado.produtos.get(dados.sku);
        if (!produto) return PULSO.erros.falha('SKU_INEXISTENTE', 'O SKU ' + dados.sku + ' não está cadastrado.');
        if (!produto.ativo) return PULSO.erros.falha('SKU_INATIVO', 'O SKU ' + dados.sku + ' está inativo e não aceita entrada.');
        const saldoResultante = PULSO.estoque.calcularSaldo(estado.movimentos, dados.sku) + dados.quantidade;
        if (!PULSO.validacao.inteiroNaoNegativo(saldoResultante)) {
          return PULSO.erros.falha('QTD_INVALIDA', 'A entrada ultrapassa o limite de unidades que o sistema calcula com exatidão.');
        }
        return null;
      },
      construir: function (dados, operacaoId, agora) {
        const movimentoId = 'MOV-' + operacaoId;
        return { tabela: 'MOVIMENTOS_ESTOQUE', linha: PULSO.movimento.construirEntrada(dados, movimentoId, operacaoId, agora) };
      },
      responder: function (estado, operacao, situacao) {
        const resposta = {
          ok: true,
          duplicada: situacao.duplicada,
          recuperada: situacao.recuperada,
          operacaoId: operacao.operacaoId,
          movimentoId: operacao.linha.movimento_id,
          sku: operacao.linha.sku,
          quantidade: operacao.linha.delta_unidades,
          saldoAtual: PULSO.estoque.calcularSaldo(estado.movimentos, operacao.linha.sku),
          mensagem: situacao.duplicada
            ? 'Entrada já registrada por esta requisição; o saldo não mudou.'
            : 'Entrada registrada.',
        };
        if (situacao.duplicada) resposta.aviso = 'OPERACAO_DUPLICADA';
        return resposta;
      },
    }, request);
  }

  function consultarEstoque(ctx, request) {
    const consulta = PULSO.validacao.eObjeto(request) ? request : {};
    if (!PULSO.validacao.skuValido(consulta.sku)) {
      return PULSO.erros.falha('SKU_INVALIDO', 'Informe o SKU no formato MER-001.');
    }
    const limite = consulta.limiteHistorico === undefined ? LIMITE_HISTORICO_PADRAO : consulta.limiteHistorico;
    if (!PULSO.validacao.inteiroPositivo(limite)) {
      return PULSO.erros.falha('DADOS_INVALIDOS', 'O limite do histórico deve ser um inteiro maior que zero.');
    }
    return PULSO.operacoes.consultar(ctx, function (estado) {
      const produto = estado.produtos.get(consulta.sku);
      if (!produto) return PULSO.erros.falha('SKU_INEXISTENTE', 'O SKU ' + consulta.sku + ' não está cadastrado.');
      const historico = PULSO.estoque.historicoComSaldo(estado.movimentos, produto.sku);
      return {
        ok: true,
        sku: produto.sku,
        nome: produto.nome,
        categoria: produto.categoria_id,
        unidade: produto.unidade,
        ativo: produto.ativo,
        saldoAtual: PULSO.estoque.calcularSaldo(estado.movimentos, produto.sku),
        estoqueMinimo: produto.estoque_minimo,
        estoqueAlvo: produto.estoque_alvo,
        totalMovimentos: historico.length,
        historico: historico.slice(-limite),
        operacoesPendentes: estado.pendentes.length,
      };
    });
  }

  function listarProdutos(ctx) {
    return PULSO.operacoes.consultar(ctx, function (estado) {
      const produtos = Array.from(estado.produtos.values())
        .sort(function (a, b) { return a.sku < b.sku ? -1 : 1; })
        .map(function (produto) {
          return {
            sku: produto.sku,
            nome: produto.nome,
            categoria: produto.categoria_id,
            precoVendaCentavos: produto.preco_venda_centavos,
            ativo: produto.ativo,
            saldoAtual: PULSO.estoque.calcularSaldo(estado.movimentos, produto.sku),
            estoqueMinimo: produto.estoque_minimo,
            estoqueAlvo: produto.estoque_alvo,
          };
        });
      return { ok: true, produtos: produtos, operacoesPendentes: estado.pendentes.length };
    });
  }

  return {
    cadastrarProduto: cadastrarProduto,
    registrarEntrada: registrarEntrada,
    consultarEstoque: consultarEstoque,
    listarProdutos: listarProdutos,
  };
})();
