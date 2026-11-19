/* Casos de uso: fornecedores, produtos, movimentos de estoque, consultas e reposição. */
/** @type {PulsoNucleo} */
var PULSO = PULSO || /** @type {PulsoNucleo} */ ({});

function pulsoCriarCasosDeUso() {
  const LIMITE_HISTORICO_PADRAO = 20;

  function cadastrarFornecedor(ctx, request) {
    return PULSO.operacoes.executar(ctx, {
      tipo: 'CADASTRO_FORNECEDOR', normalizar: PULSO.fornecedor.normalizarCadastro,
      assinatura: function (dados) { return dados; },
      verificar: function (estado, dados) {
        return estado.fornecedores.has(dados.fornecedorId) ? PULSO.erros.falha('FORNECEDOR_DUPLICADO', 'Fornecedor já cadastrado.') : null;
      },
      construir: function (dados, operacaoId, agora) {
        return { tabela: 'FORNECEDORES', linha: PULSO.fornecedor.construirLinha(dados, operacaoId, agora) };
      },
      responder: function (estado, operacao, situacao) {
        return { ok: true, operacaoId: operacao.operacaoId, fornecedorId: operacao.linha.fornecedor_id,
          duplicada: situacao.duplicada, recuperada: situacao.recuperada,
          mensagem: situacao.duplicada ? 'Cadastro já realizado por esta requisição; nada foi alterado.' : 'Fornecedor cadastrado.' };
      },
    }, request);
  }

  function listarFornecedores(ctx) {
    return PULSO.operacoes.consultar(ctx, function (estado) {
      return { ok: true, fornecedores: Array.from(estado.fornecedores.values()), operacoesPendentes: estado.pendentes.length };
    });
  }

  function alterarProduto(ctx, request) {
    return PULSO.operacoes.executar(ctx, {
      tipo: 'ALTERACAO_PRODUTO', normalizar: PULSO.alteracao.normalizar, assinatura: function (dados) { return dados; },
      verificar: function (estado, dados) {
        const produto = estado.produtos.get(dados.sku);
        if (!produto) return PULSO.erros.falha('SKU_INEXISTENTE', 'Produto não cadastrado.');
        const aplicado = PULSO.alteracao.aplicar(produto, dados.campos, produto.atualizado_em);
        if (!aplicado.ok) return aplicado;
        if (aplicado.produto.fornecedor_id && !estado.fornecedores.has(aplicado.produto.fornecedor_id)) return PULSO.erros.falha('FORNECEDOR_INEXISTENTE', 'Fornecedor não cadastrado.');
        if (!Object.keys(PULSO.alteracao.efeito(produto, dados.campos)).length) return PULSO.erros.falha('ALTERACAO_SEM_MUDANCA', 'Nenhum valor do produto foi alterado.');
        return null;
      },
      construir: function (dados, operacaoId, agora, estado) {
        return { tabela: 'PRODUTOS_ALTERACOES', linha: PULSO.alteracao.construirLinha(dados, 'ALT-' + operacaoId, operacaoId, agora,
          PULSO.alteracao.efeito(estado.produtos.get(dados.sku), dados.campos)) };
      },
      responder: function (estado, operacao, situacao) {
        return { ok: true, operacaoId: operacao.operacaoId, sku: operacao.linha.sku, duplicada: situacao.duplicada,
          recuperada: situacao.recuperada,
          mensagem: situacao.duplicada ? 'Alteração já realizada por esta requisição; nada foi alterado.' : 'Alteração de produto confirmada.' };
      },
    }, request);
  }

  function mudarStatus(ctx, request, ativo) {
    if (!PULSO.validacao.eObjeto(request)) return alterarProduto(ctx, request);
    // Mantém campos extras para que a validação do executor os rejeite.
    const dados = Object.assign({}, request, { campos: { ativo: ativo } });
    if (Object.prototype.hasOwnProperty.call(request, 'campos')) dados.campoNaoPermitido = true;
    return alterarProduto(ctx, dados);
  }

  function consultarHistoricoProduto(ctx, request) {
    if (!request || !PULSO.validacao.skuValido(request.sku)) return PULSO.erros.falha('SKU_INVALIDO', 'Informe o SKU no formato MER-001.');
    return PULSO.operacoes.consultar(ctx, function (estado) {
      if (!estado.produtos.has(request.sku)) return PULSO.erros.falha('SKU_INEXISTENTE', 'Produto não cadastrado.');
      return { ok: true, sku: request.sku, versoes: estado.versoes.get(request.sku) };
    });
  }

  function cadastrarProduto(ctx, request) {
    return PULSO.operacoes.executar(ctx, {
      tipo: 'CADASTRO_PRODUTO',
      normalizar: PULSO.produto.normalizarCadastro,
      assinatura: function (dados) { return dados; },
      verificar: function (estado, dados) {
        if (dados.fornecedorId && !estado.fornecedores.has(dados.fornecedorId)) return PULSO.erros.falha('FORNECEDOR_INEXISTENTE', 'Fornecedor não cadastrado.');
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
        const fornecedor = estado.fornecedores.get(dados.fornecedorId);
        if (!fornecedor) return PULSO.erros.falha('FORNECEDOR_INEXISTENTE', 'Fornecedor não cadastrado.');
        if (!fornecedor.ativo) return PULSO.erros.falha('FORNECEDOR_INATIVO', 'Fornecedor inativo não aceita novas entradas.');
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
        return {
          ok: true,
          duplicada: situacao.duplicada,
          recuperada: situacao.recuperada,
          operacaoId: operacao.operacaoId,
          movimentoId: operacao.linha.movimento_id,
          sku: operacao.linha.sku,
          quantidade: operacao.linha.delta_unidades,
          custoUnitCentavos: operacao.linha.custo_unit_centavos,
          fornecedorId: operacao.linha.fornecedor_id,
          saldoAtual: PULSO.estoque.calcularSaldo(estado.movimentos, operacao.linha.sku),
          mensagem: situacao.duplicada
            ? 'Entrada já registrada por esta requisição; o saldo não mudou.'
            : 'Entrada registrada.',
        };
      },
    }, request);
  }

  function registrarAdministrativo(ctx, request, tipo) {
    return PULSO.operacoes.executar(ctx, {
      tipo: tipo, normalizar: function (r) { return PULSO.movimento.normalizarAdministrativo(r, tipo); },
      assinatura: function (dados) { return dados; },
      verificar: function (estado, dados) {
        const produto = estado.produtos.get(dados.sku);
        if (!produto) return PULSO.erros.falha('SKU_INEXISTENTE', 'Produto não cadastrado.');
        const saldo = PULSO.estoque.calcularSaldo(estado.movimentos, dados.sku);
        if (tipo === 'SALDO_INICIAL' && estado.movimentos.some(function (m) { return m.sku === dados.sku; })) return PULSO.erros.falha('SALDO_INICIAL_INDEVIDO', 'O produto já tem movimentos confirmados.');
        if (tipo === 'PERDA' && dados.quantidade > saldo) return PULSO.erros.falha('SALDO_INSUFICIENTE', 'A perda supera o saldo disponível: ' + saldo + '.');
        if (tipo === 'AJUSTE' && dados.quantidadeContada === saldo) return PULSO.erros.falha('AJUSTE_SEM_DIFERENCA', 'A contagem é igual ao saldo; nenhum ajuste é necessário.');
        return null;
      },
      construir: function (dados, operacaoId, agora, estado) {
        return { tabela: 'MOVIMENTOS_ESTOQUE', linha: PULSO.movimento.construirAdministrativo(dados, tipo, 'MOV-' + operacaoId, operacaoId, agora,
          PULSO.estoque.calcularSaldo(estado.movimentos, dados.sku), estado.produtos.get(dados.sku).custo_ref_centavos) };
      },
      responder: function (estado, operacao, situacao) {
        return { ok: true, duplicada: situacao.duplicada, recuperada: situacao.recuperada,
          operacaoId: operacao.operacaoId, movimentoId: operacao.linha.movimento_id, sku: operacao.linha.sku,
          quantidade: operacao.linha.delta_unidades, saldoAtual: PULSO.estoque.calcularSaldo(estado.movimentos, operacao.linha.sku),
          mensagem: situacao.duplicada ? 'Movimentação já confirmada; nada foi duplicado.' : 'Movimentação confirmada.' };
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
        precoVendaCentavos: produto.preco_venda_centavos, custoRefCentavos: produto.custo_ref_centavos,
        fornecedorId: produto.fornecedor_id, criadoEm: produto.criado_em, atualizadoEm: produto.atualizado_em,
        saldoAtual: (estado.saldos.get(produto.sku) || 0),
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
            custoRefCentavos: produto.custo_ref_centavos, fornecedorId: produto.fornecedor_id, atualizadoEm: produto.atualizado_em,
            ativo: produto.ativo,
            saldoAtual: (estado.saldos.get(produto.sku) || 0),
            estoqueMinimo: produto.estoque_minimo,
            estoqueAlvo: produto.estoque_alvo,
          };
        });
      return { ok: true, produtos: produtos, operacoesPendentes: estado.pendentes.length };
    });
  }

  function consultarReposicao(ctx) {
    return PULSO.operacoes.consultar(ctx, function (estado) {
      const itens = [];
      estado.produtos.forEach(function (produto) {
        const saldo = (estado.saldos.get(produto.sku) || 0);
        if (!produto.ativo || saldo > produto.estoque_minimo) return;
        itens.push({ sku: produto.sku, nome: produto.nome, saldoAtual: saldo,
          estoqueMinimo: produto.estoque_minimo, estoqueAlvo: produto.estoque_alvo,
          sugestaoUnidades: Math.max(0, produto.estoque_alvo - saldo),
          fornecedor: produto.fornecedor_id ? estado.fornecedores.get(produto.fornecedor_id) : null,
          regra: 'produto ativo e saldo <= mínimo; sugestão = max(0, alvo - saldo)' });
      });
      itens.sort(function (a, b) { return a.sku.localeCompare(b.sku); });
      return { ok: true, itens: itens, operacoesPendentes: estado.pendentes.length,
        aviso: 'Sugestão para revisão humana. Nenhuma compra foi realizada.' };
    });
  }

  return {
    consultarReposicao: consultarReposicao,
    registrarSaldoInicial: function (ctx, request) { return registrarAdministrativo(ctx, request, 'SALDO_INICIAL'); },
    registrarPerda: function (ctx, request) { return registrarAdministrativo(ctx, request, 'PERDA'); },
    ajustarPorContagem: function (ctx, request) { return registrarAdministrativo(ctx, request, 'AJUSTE'); },
    alterarProduto: alterarProduto, consultarHistoricoProduto: consultarHistoricoProduto,
    desativarProduto: function (ctx, request) { return mudarStatus(ctx, request, false); },
    reativarProduto: function (ctx, request) { return mudarStatus(ctx, request, true); },
    cadastrarFornecedor: cadastrarFornecedor, listarFornecedores: listarFornecedores,
    cadastrarProduto: cadastrarProduto,
    registrarEntrada: registrarEntrada,
    consultarEstoque: consultarEstoque,
    listarProdutos: listarProdutos,
  };
}
PULSO.casosDeUso = pulsoCriarCasosDeUso();
