/* Casos de uso: fornecedores, produtos, movimentos de estoque, consultas e reposição. */
/** @type {PulsoNucleo} */
var PULSO = PULSO || /** @type {PulsoNucleo} */ ({});

function pulsoCriarCasosDeUso() {
  const LIMITE_HISTORICO_PADRAO = 20;

  /** Primeiro registro da operação; nas operações de um registro, é o próprio dado gravado. */
  function principal(operacao) {
    return operacao.registros[0].linha;
  }

  function cadastrarFornecedor(ctx, request) {
    return PULSO.operacoes.executar(ctx, {
      tipo: 'CADASTRO_FORNECEDOR', normalizar: PULSO.fornecedor.normalizarCadastro,
      assinatura: function (dados) { return dados; },
      verificar: function (estado, dados) {
        return estado.fornecedores.has(dados.fornecedorId) ? PULSO.erros.falha('FORNECEDOR_DUPLICADO', 'Fornecedor já cadastrado.') : null;
      },
      construir: function (dados, operacaoId, agora) {
        return [{ tabela: 'FORNECEDORES', linha: PULSO.fornecedor.construirLinha(dados, operacaoId, agora) }];
      },
      responder: function (estado, operacao, situacao) {
        return { ok: true, operacaoId: operacao.operacaoId, fornecedorId: principal(operacao).fornecedor_id,
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
        return [{ tabela: 'PRODUTOS_ALTERACOES', linha: PULSO.alteracao.construirLinha(dados, 'ALT-' + operacaoId, operacaoId, agora,
          PULSO.alteracao.efeito(estado.produtos.get(dados.sku), dados.campos)) }];
      },
      responder: function (estado, operacao, situacao) {
        return { ok: true, operacaoId: operacao.operacaoId, sku: principal(operacao).sku, duplicada: situacao.duplicada,
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
        return [{ tabela: 'PRODUTOS', linha: PULSO.produto.construirLinha(dados, operacaoId, agora) }];
      },
      responder: function (estado, operacao, situacao) {
        return {
          ok: true,
          duplicada: situacao.duplicada,
          recuperada: situacao.recuperada,
          operacaoId: operacao.operacaoId,
          sku: principal(operacao).sku,
          mensagem: situacao.duplicada
            ? 'Cadastro já realizado por esta requisição; nada foi alterado.'
            : 'Produto ' + principal(operacao).sku + ' cadastrado.',
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
        return [{ tabela: 'MOVIMENTOS_ESTOQUE', linha: PULSO.movimento.construirEntrada(dados, movimentoId, operacaoId, agora) }];
      },
      responder: function (estado, operacao, situacao) {
        return {
          ok: true,
          duplicada: situacao.duplicada,
          recuperada: situacao.recuperada,
          operacaoId: operacao.operacaoId,
          movimentoId: principal(operacao).movimento_id,
          sku: principal(operacao).sku,
          quantidade: principal(operacao).delta_unidades,
          custoUnitCentavos: principal(operacao).custo_unit_centavos,
          fornecedorId: principal(operacao).fornecedor_id,
          saldoAtual: PULSO.estoque.calcularSaldo(estado.movimentos, principal(operacao).sku),
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
        return [{ tabela: 'MOVIMENTOS_ESTOQUE', linha: PULSO.movimento.construirAdministrativo(dados, tipo, 'MOV-' + operacaoId, operacaoId, agora,
          PULSO.estoque.calcularSaldo(estado.movimentos, dados.sku), estado.produtos.get(dados.sku).custo_ref_centavos) }];
      },
      responder: function (estado, operacao, situacao) {
        return { ok: true, duplicada: situacao.duplicada, recuperada: situacao.recuperada,
          operacaoId: operacao.operacaoId, movimentoId: principal(operacao).movimento_id, sku: principal(operacao).sku,
          quantidade: principal(operacao).delta_unidades, saldoAtual: PULSO.estoque.calcularSaldo(estado.movimentos, principal(operacao).sku),
          mensagem: situacao.duplicada ? 'Movimentação já confirmada; nada foi duplicado.' : 'Movimentação confirmada.' };
      },
    }, request);
  }

  /** Contagem de vários SKUs: tudo ou nada, um AJUSTE por SKU com diferença (M-03, D-050). */
  function registrarContagem(ctx, request) {
    return PULSO.operacoes.executar(ctx, {
      tipo: 'CONTAGEM_INVENTARIO', normalizar: PULSO.movimento.normalizarContagem,
      assinatura: function (dados) { return dados; },
      verificar: function (estado, dados) {
        const ausente = dados.itens.find(function (item) { return !estado.produtos.has(item.sku); });
        if (ausente) return PULSO.erros.falha('SKU_INEXISTENTE', 'O SKU ' + ausente.sku + ' não está cadastrado. Nenhum item da contagem foi registrado.');
        const comDiferenca = dados.itens.some(function (item) { return (estado.saldos.get(item.sku) || 0) !== item.quantidadeContada; });
        if (!comDiferenca) return PULSO.erros.falha('AJUSTE_SEM_DIFERENCA', 'Todos os itens contados conferem com o saldo; nenhum ajuste é necessário.');
        return null;
      },
      construir: function (dados, operacaoId, agora, estado) {
        const registros = [];
        dados.itens.forEach(function (item) {
          const saldo = estado.saldos.get(item.sku) || 0;
          if (saldo === item.quantidadeContada) return;
          registros.push({ tabela: 'MOVIMENTOS_ESTOQUE', linha: PULSO.movimento.construirAdministrativo(
            { sku: item.sku, quantidadeContada: item.quantidadeContada, motivo: dados.motivo, operadorSimulado: dados.operadorSimulado },
            'AJUSTE', 'MOV-' + operacaoId + '-' + (registros.length + 1), operacaoId, agora, saldo, estado.produtos.get(item.sku).custo_ref_centavos) });
        });
        return registros;
      },
      responder: function (estado, operacao, situacao) {
        const ajustados = operacao.registros.map(function (r) {
          return { sku: r.linha.sku, movimentoId: r.linha.movimento_id, saldoAnterior: r.linha.saldo_anterior,
            saldoNovo: r.linha.saldo_novo, deltaUnidades: r.linha.delta_unidades };
        });
        const skusAjustados = new Set(ajustados.map(function (a) { return a.sku; }));
        const semDiferenca = JSON.parse(operacao.assinatura).itens
          .filter(function (item) { return !skusAjustados.has(item.sku); })
          .map(function (item) { return item.sku; });
        return { ok: true, duplicada: situacao.duplicada, recuperada: situacao.recuperada, operacaoId: operacao.operacaoId,
          ajustados: ajustados, semDiferenca: semDiferenca,
          mensagem: situacao.duplicada ? 'Contagem já registrada por esta requisição; nada foi duplicado.'
            : 'Contagem registrada: ' + ajustados.length + ' ajuste(s).' };
      },
    }, request);
  }

  /** Venda com vários itens (Fase 2): tudo ou nada, valores capturados no momento da venda. */
  function confirmarVenda(ctx, request) {
    return PULSO.operacoes.executar(ctx, {
      tipo: 'VENDA', normalizar: PULSO.venda.normalizarVenda, assinatura: function (dados) { return dados; },
      verificar: function (estado, dados) {
        for (let i = 0; i < dados.itens.length; i++) {
          const item = dados.itens[i];
          const produto = estado.produtos.get(item.sku);
          if (!produto) return PULSO.erros.falha('SKU_INEXISTENTE', 'O SKU ' + item.sku + ' não está cadastrado. Nenhum item foi vendido.');
          if (!produto.ativo) return PULSO.erros.falha('SKU_INATIVO', 'O SKU ' + item.sku + ' está inativo e não pode ser vendido. Nenhum item foi vendido.');
          const saldo = estado.saldos.get(item.sku) || 0;
          if (item.quantidade > saldo) {
            return PULSO.erros.falha('SALDO_INSUFICIENTE', 'Saldo insuficiente de ' + item.sku + ': disponível ' + saldo + ', pedido ' + item.quantidade + '. Nenhum item foi vendido.',
              { sku: item.sku, saldoDisponivel: saldo, quantidadePedida: item.quantidade });
          }
        }
        if (!PULSO.venda.totais(dados.itens, capturasDe(estado, dados))) {
          return PULSO.erros.falha('DADOS_INVALIDOS', 'O total da venda ultrapassa o limite que o sistema calcula com exatidão.');
        }
        return null;
      },
      construir: function (dados, operacaoId, agora, estado, requisicaoId) {
        return PULSO.venda.construirRegistrosVenda(dados, operacaoId, requisicaoId, agora, capturasDe(estado, dados));
      },
      responder: function (estado, operacao, situacao) {
        const venda = principal(operacao);
        const itens = operacao.registros.filter(function (r) { return r.tabela === 'ITENS_VENDA'; }).map(function (r) {
          return { sku: r.linha.sku, quantidade: r.linha.quantidade, precoUnitCentavos: r.linha.preco_unit_centavos,
            subtotalCentavos: r.linha.subtotal_centavos, saldoAtual: estado.saldos.get(r.linha.sku) || 0 };
        });
        return { ok: true, duplicada: situacao.duplicada, recuperada: situacao.recuperada, operacaoId: operacao.operacaoId,
          vendaId: venda.venda_id, totalCentavos: venda.total_centavos, custoEstCentavos: venda.custo_est_centavos,
          formaPagamento: venda.forma_pagamento, itens: itens,
          mensagem: situacao.duplicada ? 'Venda já registrada por esta requisição; nada foi duplicado.' : 'Venda ' + venda.venda_id + ' confirmada.' };
      },
    }, request);
  }

  /** Preço de venda e custo de referência vigentes, na ordem dos itens. */
  function capturasDe(estado, dados) {
    return dados.itens.map(function (item) {
      const produto = estado.produtos.get(item.sku);
      return { precoUnitCentavos: produto.preco_venda_centavos, custoUnitCentavos: produto.custo_ref_centavos };
    });
  }

  /** Estorno total e único, devolvendo as unidades ao estoque (simplificação documentada em D-057). */
  function estornarVenda(ctx, request) {
    return PULSO.operacoes.executar(ctx, {
      tipo: 'ESTORNO_VENDA', normalizar: PULSO.venda.normalizarEstorno, assinatura: function (dados) { return dados; },
      verificar: function (estado, dados) {
        const registro = estado.vendas.get(dados.vendaId);
        if (!registro) return PULSO.erros.falha('VENDA_INEXISTENTE', 'A venda ' + dados.vendaId + ' não existe.');
        if (registro.estorno) return PULSO.erros.falha('VENDA_JA_ESTORNADA', 'A venda ' + dados.vendaId + ' já foi estornada por outra requisição.');
        const excedente = registro.itens.find(function (item) {
          return !PULSO.validacao.inteiroNaoNegativo((estado.saldos.get(item.sku) || 0) + item.quantidade);
        });
        if (excedente) return PULSO.erros.falha('QTD_INVALIDA', 'A devolução de ' + excedente.sku + ' ultrapassa o limite de unidades exatas. Nenhum item foi estornado.');
        return null;
      },
      construir: function (dados, operacaoId, agora, estado, requisicaoId) {
        const itens = estado.vendas.get(dados.vendaId).itens.map(function (item) {
          return { sku: item.sku, quantidade: item.quantidade, custoUnitCentavos: item.custo_unit_est_centavos };
        });
        return PULSO.venda.construirRegistrosEstorno(dados, operacaoId, requisicaoId, agora, itens);
      },
      responder: function (estado, operacao, situacao) {
        const estorno = principal(operacao);
        return { ok: true, duplicada: situacao.duplicada, recuperada: situacao.recuperada, operacaoId: operacao.operacaoId,
          estornoId: estorno.estorno_id, vendaId: estorno.venda_id,
          devolvidos: operacao.registros.slice(1).map(function (r) {
            return { sku: r.linha.sku, quantidade: r.linha.delta_unidades, saldoAtual: estado.saldos.get(r.linha.sku) || 0 };
          }),
          mensagem: situacao.duplicada ? 'Estorno já registrado por esta requisição; nada foi duplicado.' : 'Venda ' + estorno.venda_id + ' estornada.' };
      },
    }, request);
  }

  function resumoVenda(registro) {
    const v = registro.venda;
    return { vendaId: v.venda_id, requisicaoId: v.requisicao_id, registradoEm: v.registrado_em, formaPagamento: v.forma_pagamento,
      totalCentavos: v.total_centavos, custoEstCentavos: v.custo_est_centavos, observacao: v.observacao,
      operadorSimulado: v.operador_simulado, quantidadeItens: registro.itens.length,
      estado: registro.estorno ? 'ESTORNADA' : 'CONFIRMADA' };
  }

  const INSTANTE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
  function instanteValido(valor) {
    return typeof valor === 'string' && INSTANTE.test(valor) && Number.isFinite(Date.parse(valor)) && new Date(valor).toISOString() === valor;
  }

  /** Vendas confirmadas, mais recentes primeiro. desde (inclusivo) e ate (exclusivo) em instantes ISO UTC. */
  function listarVendas(ctx, request) {
    const v = PULSO.validacao;
    if (request !== undefined && !v.eObjeto(request)) return PULSO.erros.falha('DADOS_INVALIDOS', 'Envie a consulta como objeto.');
    const consulta = request === undefined ? {} : request;
    if (v.camposDesconhecidos(consulta, ['desde', 'ate', 'limite']).length ||
        (consulta.desde !== undefined && !instanteValido(consulta.desde)) ||
        (consulta.ate !== undefined && !instanteValido(consulta.ate)) ||
        (consulta.desde !== undefined && consulta.ate !== undefined && consulta.desde >= consulta.ate) ||
        (consulta.limite !== undefined && !(v.inteiroPositivo(consulta.limite) && consulta.limite <= 500))) {
      return PULSO.erros.falha('DADOS_INVALIDOS', 'Período em instantes ISO (AAAA-MM-DDTHH:MM:SS.mmmZ) e limite inteiro de 1 a 500.');
    }
    return PULSO.operacoes.consultar(ctx, function (estado) {
      const vendas = Array.from(estado.vendas.values())
        .filter(function (r) {
          return (consulta.desde === undefined || r.venda.registrado_em >= consulta.desde) &&
            (consulta.ate === undefined || r.venda.registrado_em < consulta.ate);
        })
        .reverse()
        .slice(0, consulta.limite === undefined ? 100 : consulta.limite)
        .map(resumoVenda);
      return { ok: true, vendas: vendas, operacoesPendentes: estado.pendentes.length };
    });
  }

  /** Detalhe por vendaId ou por requisicaoId (exatamente um dos dois). */
  function consultarVenda(ctx, request) {
    const v = PULSO.validacao;
    const consulta = v.eObjeto(request) ? request : {};
    const porVenda = typeof consulta.vendaId === 'string' && consulta.vendaId.length > 0;
    const porRequisicao = typeof consulta.requisicaoId === 'string' && consulta.requisicaoId.length > 0;
    if (v.camposDesconhecidos(consulta, ['vendaId', 'requisicaoId']).length || porVenda === porRequisicao) {
      return PULSO.erros.falha('DADOS_INVALIDOS', 'Informe vendaId ou requisicaoId, apenas um deles.');
    }
    return PULSO.operacoes.consultar(ctx, function (estado) {
      let registro = porVenda ? estado.vendas.get(consulta.vendaId) : null;
      if (porRequisicao) {
        estado.vendas.forEach(function (r) { if (r.venda.requisicao_id === consulta.requisicaoId) registro = r; });
      }
      if (!registro) return PULSO.erros.falha('VENDA_INEXISTENTE', 'Venda não encontrada.');
      return {
        ok: true, venda: resumoVenda(registro),
        itens: registro.itens.map(function (i) {
          return { itemId: i.item_id, sku: i.sku, quantidade: i.quantidade, precoUnitCentavos: i.preco_unit_centavos,
            custoUnitEstCentavos: i.custo_unit_est_centavos, subtotalCentavos: i.subtotal_centavos };
        }),
        movimentos: registro.movimentos.map(function (m) {
          return { movimentoId: m.movimento_id, tipo: m.tipo, sku: m.sku, deltaUnidades: m.delta_unidades, registradoEm: m.registrado_em };
        }),
        estorno: registro.estorno ? { estornoId: registro.estorno.estorno_id, registradoEm: registro.estorno.registrado_em,
          motivo: registro.estorno.motivo, operadorSimulado: registro.estorno.operador_simulado } : null,
        operacoesPendentes: estado.pendentes.length,
      };
    });
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
    registrarContagem: registrarContagem,
    confirmarVenda: confirmarVenda, estornarVenda: estornarVenda, listarVendas: listarVendas, consultarVenda: consultarVenda,
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
