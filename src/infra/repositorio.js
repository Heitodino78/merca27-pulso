/*
 * Repositório sobre uma porta de armazenamento somente-acréscimo:
 *   armazenamento.ler(tabela) -> linhas
 *   armazenamento.anexar(tabela, linha)
 * A porta não oferece editar nem apagar: o histórico não pode ser reescrito pelo fluxo normal.
 */
/** @type {PulsoNucleo} */
var PULSO = PULSO || /** @type {PulsoNucleo} */ ({});

function pulsoCriarRepositorio() {
  function inconsistente(mensagem) {
    return PULSO.erros.criarExcecao('DADOS_INCONSISTENTES', 'Dados inconsistentes: ' + mensagem + '.');
  }

  function lerTabela(armazenamento, tabela) {
    const esquema = PULSO.esquema;
    const chave = esquema.TABELAS[tabela].chave;
    const vistos = new Set();
    const linhas = armazenamento.ler(tabela);
    linhas.forEach(function (linha, indice) {
      const problema = esquema.problemaLinha(tabela, linha);
      if (problema) throw inconsistente(tabela + ', linha ' + (indice + 1) + ': ' + problema);
      if (vistos.has(linha[chave])) throw inconsistente(tabela + ': chave repetida ' + linha[chave]);
      vistos.add(linha[chave]);
    });
    return linhas;
  }

  const TABELAS_DE_DADOS = ['PRODUTOS', 'MOVIMENTOS_ESTOQUE', 'FORNECEDORES', 'PRODUTOS_ALTERACOES', 'VENDAS', 'ITENS_VENDA', 'ESTORNOS_VENDA'];
  const LIMITE_REGISTROS = 200;
  /** Tipos que já existiam quando o payload era { tabela, linha }; tipos novos só usam o formato atual. */
  const TIPOS_LEGADOS = ['CADASTRO_PRODUTO', 'ENTRADA', 'CADASTRO_FORNECEDOR', 'ALTERACAO_PRODUTO', 'SALDO_INICIAL', 'PERDA', 'AJUSTE'];

  /**
   * Payload atual: { registros: [{ tabela, linha }, ...] }. O formato da Fase 01,
   * { tabela, linha }, continua legível como lista de um registro, sem reescrever o log (D-049).
   */
  function lerRegistros(evento, payload) {
    const v = PULSO.validacao;
    const invalido = function () { return inconsistente('operação ' + evento.operacao_id + ' com payload inválido'); };
    let registros;
    if (v.eObjeto(payload) && Object.keys(payload).length === 1 && Array.isArray(payload.registros)) registros = payload.registros;
    else if (v.eObjeto(payload) && Object.keys(payload).length === 2 && 'tabela' in payload && 'linha' in payload &&
        TIPOS_LEGADOS.indexOf(evento.tipo) !== -1) registros = [payload];
    else throw invalido();
    if (!registros.length || registros.length > LIMITE_REGISTROS) throw invalido();
    const vistos = new Set();
    return registros.map(function (registro) {
      if (!v.eObjeto(registro) || Object.keys(registro).length !== 2 || TABELAS_DE_DADOS.indexOf(registro.tabela) === -1) throw invalido();
      const problema = PULSO.esquema.problemaLinha(registro.tabela, registro.linha);
      if (problema) throw inconsistente('operação ' + evento.operacao_id + ': ' + problema);
      const identificador = registro.tabela + '|' + registro.linha[PULSO.esquema.TABELAS[registro.tabela].chave];
      if (vistos.has(identificador)) throw inconsistente('operação ' + evento.operacao_id + ' com registro repetido');
      vistos.add(identificador);
      return { tabela: registro.tabela, linha: registro.linha };
    });
  }

  function abrirIntencao(evento) {
    let payload;
    try {
      payload = JSON.parse(evento.payload);
    } catch (e) {
      throw inconsistente('operação ' + evento.operacao_id + ' com payload ilegível');
    }
    const registros = lerRegistros(evento, payload);
    if (!PULSO.validacao.requisicaoValida(evento.requisicao_id) || !evento.assinatura) {
      throw inconsistente('operação ' + evento.operacao_id + ' sem requisição ou assinatura');
    }
    conferirIntencao(evento, registros);
    const principal = registros[0];
    return {
      operacaoId: evento.operacao_id,
      requisicaoId: evento.requisicao_id,
      tipo: evento.tipo,
      estado: evento.estado,
      tentativas: evento.tentativas,
      assinatura: evento.assinatura,
      registros: registros,
      // referencia_id dos eventos é sempre a chave do primeiro registro da lista.
      referenciaId: principal.linha[PULSO.esquema.TABELAS[principal.tabela].chave],
    };
  }

  /** Contagem de inventário: um AJUSTE por SKU com diferença, na ordem dos itens do pedido. */
  function conferirContagem(evento, registros) {
    const v = PULSO.validacao;
    let normalizado;
    try { normalizado = PULSO.movimento.normalizarContagem(JSON.parse(evento.assinatura)); }
    catch (erro) { throw inconsistente('assinatura de contagem inválida'); }
    if (!normalizado.ok || evento.assinatura !== JSON.stringify(normalizado.dados) ||
        evento.tentativas !== 1 || evento.erro_cod !== null || registros.length > normalizado.dados.itens.length) {
      throw inconsistente('operação ' + evento.operacao_id + ' com intenção de contagem incompatível');
    }
    const itens = normalizado.dados.itens;
    const registradoEm = registros[0].linha.registrado_em;
    let posicao = 0;
    registros.forEach(function (registro, indice) {
      const linha = registro.linha;
      if (registro.tabela !== 'MOVIMENTOS_ESTOQUE') throw inconsistente('contagem com registro fora de MOVIMENTOS_ESTOQUE');
      while (posicao < itens.length && itens[posicao].sku !== linha.sku) posicao++;
      if (posicao === itens.length) throw inconsistente('contagem com movimento fora da ordem dos itens');
      const item = itens[posicao++];
      if (!v.inteiroNaoNegativo(linha.custo_unit_centavos) || !v.inteiroNaoNegativo(linha.saldo_anterior) ||
          linha.registrado_em !== registradoEm || linha.delta_unidades === 0) {
        throw inconsistente('contagem com movimento inválido');
      }
      const reconstruida = PULSO.movimento.construirAdministrativo(
        { sku: item.sku, quantidadeContada: item.quantidadeContada, motivo: normalizado.dados.motivo, operadorSimulado: normalizado.dados.operadorSimulado },
        'AJUSTE', 'MOV-' + evento.operacao_id + '-' + (indice + 1), evento.operacao_id, linha.registrado_em, linha.saldo_anterior, linha.custo_unit_centavos);
      if (PULSO.esquema.canonica('MOVIMENTOS_ESTOQUE', linha) !== PULSO.esquema.canonica('MOVIMENTOS_ESTOQUE', reconstruida)) {
        throw inconsistente('operação ' + evento.operacao_id + ' com movimento divergente da contagem');
      }
    });
    if (evento.referencia_id !== registros[0].linha.movimento_id) {
      throw inconsistente('operação ' + evento.operacao_id + ' com referência divergente');
    }
  }

  /** Os registros da intenção precisam ser exatamente os que as regras de domínio construiriam. */
  function conferirIguais(evento, registros, esperados) {
    if (registros.length !== esperados.length) throw inconsistente('operação ' + evento.operacao_id + ' com quantidade de registros divergente');
    esperados.forEach(function (esperado, i) {
      const registro = registros[i];
      if (registro.tabela !== esperado.tabela ||
          PULSO.esquema.canonica(esperado.tabela, registro.linha) !== PULSO.esquema.canonica(esperado.tabela, esperado.linha)) {
        throw inconsistente('operação ' + evento.operacao_id + ' com registro ' + (i + 1) + ' divergente da intenção');
      }
    });
  }

  function intencaoDe(evento, normalizar) {
    let normalizado;
    try { normalizado = normalizar(JSON.parse(evento.assinatura)); }
    catch (erro) { throw inconsistente('operação ' + evento.operacao_id + ' com assinatura ilegível'); }
    if (!normalizado.ok || evento.assinatura !== JSON.stringify(normalizado.dados) || evento.tentativas !== 1 || evento.erro_cod !== null) {
      throw inconsistente('operação ' + evento.operacao_id + ' com intenção incompatível com as regras de domínio');
    }
    return normalizado.dados;
  }

  /** Venda: VENDAS, itens e movimentos reconstruídos a partir do pedido e dos valores capturados. */
  function conferirVenda(evento, registros) {
    const dados = intencaoDe(evento, PULSO.venda.normalizarVenda);
    const n = dados.itens.length;
    if (registros.length !== 1 + 2 * n || registros[0].tabela !== 'VENDAS') throw inconsistente('venda com registros fora do formato');
    const capturas = registros.slice(1, 1 + n).map(function (r) {
      return { precoUnitCentavos: r.linha.preco_unit_centavos, custoUnitCentavos: r.linha.custo_unit_est_centavos };
    });
    if (!capturas.every(function (c) { return PULSO.validacao.inteiroNaoNegativo(c.precoUnitCentavos) && PULSO.validacao.inteiroNaoNegativo(c.custoUnitCentavos); }) ||
        !PULSO.venda.totais(dados.itens, capturas)) {
      throw inconsistente('venda com valores capturados inválidos');
    }
    const esperados = PULSO.venda.construirRegistrosVenda(dados, evento.operacao_id, evento.requisicao_id, registros[0].linha.registrado_em, capturas);
    conferirIguais(evento, registros, esperados);
    if (evento.referencia_id !== /** @type {LinhaVenda} */ (esperados[0].linha).venda_id) throw inconsistente('venda com referência divergente');
  }

  /** Estorno: ESTORNOS_VENDA e um ESTORNO por item; o espelho dos itens é conferido na reprodução. */
  function conferirEstorno(evento, registros) {
    const dados = intencaoDe(evento, PULSO.venda.normalizarEstorno);
    if (registros.length < 2 || registros[0].tabela !== 'ESTORNOS_VENDA') throw inconsistente('estorno com registros fora do formato');
    const itens = registros.slice(1).map(function (r) {
      return { sku: r.linha.sku, quantidade: r.linha.delta_unidades, custoUnitCentavos: r.linha.custo_unit_centavos };
    });
    if (!itens.every(function (i) { return PULSO.validacao.inteiroPositivo(i.quantidade) && PULSO.validacao.inteiroNaoNegativo(i.custoUnitCentavos); })) {
      throw inconsistente('estorno com quantidades ou custos inválidos');
    }
    const esperados = PULSO.venda.construirRegistrosEstorno(dados, evento.operacao_id, evento.requisicao_id, registros[0].linha.registrado_em, itens);
    conferirIguais(evento, registros, esperados);
    if (evento.referencia_id !== /** @type {LinhaEstornoVenda} */ (esperados[0].linha).estorno_id) throw inconsistente('estorno com referência divergente');
  }

  /** A intenção recuperável precisa respeitar as mesmas regras do pedido original. */
  function conferirIntencao(evento, registros) {
    if (evento.tipo === 'VENDA') return conferirVenda(evento, registros);
    if (evento.tipo === 'ESTORNO_VENDA') return conferirEstorno(evento, registros);
    if (evento.tipo === 'CONTAGEM_INVENTARIO') return conferirContagem(evento, registros);
    if (registros.length !== 1) throw inconsistente('operação ' + evento.operacao_id + ' do tipo ' + evento.tipo + ' com mais de um registro');
    const payload = registros[0];
    const linha = payload.linha;
    let normalizado;
    let reconstruida;
    if (payload.tabela === 'PRODUTOS' && evento.tipo === 'CADASTRO_PRODUTO') {
      normalizado = PULSO.produto.normalizarCadastro({
        sku: linha.sku, nome: linha.nome, categoria: linha.categoria_id, unidade: linha.unidade,
        precoVendaCentavos: linha.preco_venda_centavos, custoRefCentavos: linha.custo_ref_centavos,
        estoqueMinimo: linha.estoque_minimo, estoqueAlvo: linha.estoque_alvo,
        fornecedorId: linha.fornecedor_id, ativo: linha.ativo,
      });
      if (normalizado.ok) reconstruida = PULSO.produto.construirLinha(normalizado.dados, evento.operacao_id, linha.criado_em);
    } else if (payload.tabela === 'MOVIMENTOS_ESTOQUE' && evento.tipo === 'ENTRADA') {
      normalizado = PULSO.movimento.normalizarEntrada({
        sku: linha.sku, quantidade: linha.delta_unidades, referenciaFornecedor: linha.referencia_id,
        motivo: linha.motivo, operadorSimulado: linha.operador_simulado,
        custoUnitCentavos: linha.custo_unit_centavos, fornecedorId: linha.fornecedor_id,
      });
      if (normalizado.ok) reconstruida = PULSO.movimento.construirEntrada(normalizado.dados, linha.movimento_id, evento.operacao_id, linha.registrado_em);
    } else if (payload.tabela === 'FORNECEDORES' && evento.tipo === 'CADASTRO_FORNECEDOR') {
      normalizado = PULSO.fornecedor.normalizarCadastro({ fornecedorId: linha.fornecedor_id, nomeFicticio: linha.nome_ficticio,
        categoriaPrincipal: linha.categoria_principal, prazoEstimadoDias: linha.prazo_estimado_dias, ativo: linha.ativo });
      if (normalizado.ok) reconstruida = PULSO.fornecedor.construirLinha(normalizado.dados, evento.operacao_id, linha.criado_em);
    } else if (payload.tabela === 'MOVIMENTOS_ESTOQUE' && ['SALDO_INICIAL', 'PERDA', 'AJUSTE'].indexOf(evento.tipo) !== -1) {
      try { normalizado = PULSO.movimento.normalizarAdministrativo(JSON.parse(evento.assinatura), evento.tipo); }
      catch (erro) { throw inconsistente('assinatura de movimento inválida'); }
      if (!PULSO.validacao.inteiroNaoNegativo(linha.custo_unit_centavos) || linha.delta_unidades === 0 ||
          (evento.tipo === 'AJUSTE' && !PULSO.validacao.inteiroNaoNegativo(linha.saldo_anterior))) throw inconsistente('movimento administrativo inválido');
      if (normalizado.ok) reconstruida = PULSO.movimento.construirAdministrativo(normalizado.dados, evento.tipo,
        linha.movimento_id, evento.operacao_id, linha.registrado_em, linha.saldo_anterior, linha.custo_unit_centavos);
    } else if (payload.tabela === 'PRODUTOS_ALTERACOES' && evento.tipo === 'ALTERACAO_PRODUTO') {
      try {
        normalizado = PULSO.alteracao.normalizar(JSON.parse(evento.assinatura));
        const campos = JSON.parse(linha.campos_json);
        if (!PULSO.validacao.eObjeto(campos) || !Object.keys(campos).length ||
            !normalizado.ok || Object.keys(campos).some(function (c) { return campos[c] !== normalizado.dados.campos[c]; })) {
          throw inconsistente('alteração divergente do pedido');
        }
        reconstruida = PULSO.alteracao.construirLinha(normalizado.dados, linha.alteracao_id, evento.operacao_id, linha.registrado_em, campos);
      } catch (erro) { throw inconsistente('alteração com campos ou assinatura inválidos'); }
    }
    const chave = PULSO.esquema.TABELAS[payload.tabela].chave;
    if (!normalizado || !('dados' in normalizado)) {
      throw inconsistente('operação ' + evento.operacao_id + ' com intenção inválida');
    }
    if (!reconstruida || evento.tentativas !== 1 || evento.erro_cod !== null ||
        evento.referencia_id !== linha[chave] ||
        evento.assinatura !== JSON.stringify(normalizado.dados) ||
        PULSO.esquema.canonica(payload.tabela, linha) !== PULSO.esquema.canonica(payload.tabela, reconstruida)) {
      throw inconsistente('operação ' + evento.operacao_id + ' com intenção incompatível com as regras de domínio');
    }
  }

  /** O log é uma sequência de eventos; o estado de cada operação é o último evento dela. */
  function dobrarOperacoes(eventos) {
    const operacoes = new Map();
    const porRequisicao = new Map();
    const rejeitadas = new Set();
    eventos.forEach(function (evento) {
      if (['PENDENTE', 'PENDENTE_RECONCILIACAO', 'CONFIRMADA', 'REJEITADA'].indexOf(evento.estado) === -1 ||
          evento.tentativas < 1 || ['CADASTRO_PRODUTO', 'ENTRADA', 'CADASTRO_FORNECEDOR', 'ALTERACAO_PRODUTO', 'SALDO_INICIAL', 'PERDA', 'AJUSTE', 'CONTAGEM_INVENTARIO', 'VENDA', 'ESTORNO_VENDA'].indexOf(evento.tipo) === -1) {
        throw inconsistente('operação ' + evento.operacao_id + ' com evento inválido');
      }
      if (evento.estado === 'REJEITADA') {
        if (operacoes.has(evento.operacao_id) || rejeitadas.has(evento.operacao_id) ||
            evento.erro_cod === null || evento.assinatura !== null || evento.payload !== null) {
          throw inconsistente('operação ' + evento.operacao_id + ' com rejeição inválida');
        }
        rejeitadas.add(evento.operacao_id);
        return;
      }
      if (rejeitadas.has(evento.operacao_id)) throw inconsistente('identificador de operação reutilizado');
      const operacao = operacoes.get(evento.operacao_id);
      if (!operacao) {
        if (evento.estado !== 'PENDENTE') throw inconsistente('operação ' + evento.operacao_id + ' sem intenção registrada');
        if (porRequisicao.has(evento.requisicao_id)) throw inconsistente('requisição ' + evento.requisicao_id + ' com duas operações');
        const nova = abrirIntencao(evento);
        operacoes.set(nova.operacaoId, nova);
        porRequisicao.set(nova.requisicaoId, nova);
        return;
      }
      if (operacao.estado === 'CONFIRMADA' || evento.estado === 'PENDENTE') {
        throw inconsistente('operação ' + evento.operacao_id + ' com sequência de estados inválida');
      }
      if (evento.tipo !== operacao.tipo || evento.requisicao_id !== operacao.requisicaoId ||
          evento.referencia_id !== operacao.referenciaId || evento.tentativas < operacao.tentativas ||
          evento.assinatura !== null || evento.payload !== null ||
          (evento.estado === 'CONFIRMADA' ? evento.erro_cod !== null : evento.erro_cod !== 'FALHA_GRAVACAO')) {
        throw inconsistente('operação ' + evento.operacao_id + ' com evento divergente da intenção');
      }
      operacao.estado = evento.estado;
      operacao.tentativas = evento.tentativas;
    });
    return { operacoes: operacoes, porRequisicao: porRequisicao };
  }

  /** Cada linha de dado precisa constar, exatamente igual, na lista da operação que a originou. */
  function conferirOrigem(tabela, linhas, operacoes) {
    const esquema = PULSO.esquema;
    const chave = esquema.TABELAS[tabela].chave;
    linhas.forEach(function (linha) {
      const operacao = operacoes.get(linha.operacao_id);
      const registro = operacao && operacao.registros.find(function (r) { return r.tabela === tabela && r.linha[chave] === linha[chave]; });
      if (!registro) {
        throw inconsistente(tabela + ': registro ' + linha[chave] + ' sem operação de origem');
      }
      if (esquema.canonica(tabela, linha) !== esquema.canonica(tabela, registro.linha)) {
        throw inconsistente(tabela + ': registro ' + linha[chave] + ' difere do que foi confirmado');
      }
    });
  }

  function conferirMovimentos(movimentos) {
    const saldos = new Map();
    movimentos.forEach(function (movimento) {
      if (PULSO.movimento.TIPOS.indexOf(movimento.tipo) === -1 || movimento.delta_unidades === 0) {
        throw inconsistente('movimento ' + movimento.movimento_id + ' inválido');
      }
      const saldo = (saldos.get(movimento.sku) || 0) + movimento.delta_unidades;
      if (saldo < 0) throw inconsistente('saldo negativo em ' + movimento.sku);
      if (!PULSO.validacao.inteiroSeguro(saldo)) throw inconsistente('saldo fora do limite de inteiros exatos em ' + movimento.sku);
      saldos.set(movimento.sku, saldo);
    });
  }

  /** Itens contados sem movimento só são válidos se já conferiam com o saldo naquele instante. */
  function conferirItensContados(operacao, produtos, saldos) {
    const ajustados = new Set(operacao.registros.map(function (r) { return r.linha.sku; }));
    JSON.parse(operacao.assinatura).itens.forEach(function (item) {
      if (!produtos.has(item.sku)) throw inconsistente('contagem de SKU inexistente ' + item.sku);
      if (!ajustados.has(item.sku) && (saldos.get(item.sku) || 0) !== item.quantidadeContada) {
        throw inconsistente('contagem sem ajuste para ' + item.sku + ', que tinha diferença');
      }
    });
  }

  /** No instante da venda: produto existente e ativo, preço e custo do cadastro vigente e saldo suficiente. */
  function conferirVendaNoEstado(operacao, produtos, saldos) {
    operacao.registros.filter(function (r) { return r.tabela === 'ITENS_VENDA'; }).forEach(function (r) {
      const item = r.linha;
      const produto = produtos.get(item.sku);
      if (!produto) throw inconsistente('venda de SKU inexistente ' + item.sku);
      if (!produto.ativo) throw inconsistente('venda de produto inativo ' + item.sku);
      if (item.preco_unit_centavos !== produto.preco_venda_centavos || item.custo_unit_est_centavos !== produto.custo_ref_centavos) {
        throw inconsistente('venda com preço ou custo divergente do cadastro vigente em ' + item.sku);
      }
      if ((saldos.get(item.sku) || 0) < item.quantidade) throw inconsistente('venda acima do saldo de ' + item.sku);
    });
  }

  /** Estorno total, uma única vez, espelhando exatamente os itens da venda. */
  function conferirEstornoNoEstado(operacao, vendas) {
    const estorno = operacao.registros[0].linha;
    const registro = vendas.get(estorno.venda_id);
    if (!registro) throw inconsistente('estorno de venda inexistente ' + estorno.venda_id);
    if (registro.estorno) throw inconsistente('venda ' + estorno.venda_id + ' estornada mais de uma vez');
    const movimentos = operacao.registros.slice(1).map(function (r) { return r.linha; });
    if (movimentos.length !== registro.itens.length || registro.itens.some(function (item, i) {
      const m = movimentos[i];
      return m.sku !== item.sku || m.delta_unidades !== item.quantidade || m.custo_unit_centavos !== item.custo_unit_est_centavos;
    })) {
      throw inconsistente('estorno diferente dos itens da venda ' + estorno.venda_id);
    }
  }

  /** @param {ArmazenamentoPulso} armazenamento */
  function criar(armazenamento) {
    // Vale só na continuação da mesma seção crítica: auxilia existe() e a resposta
    // final do executor. Toda verificação pós-gravação continua consultando a porta.
    const ultimasTabelas = new Map();
    function lerAtual(tabela) {
      const linhas = lerTabela(armazenamento, tabela);
      ultimasTabelas.set(tabela, linhas);
      return linhas;
    }
    /** @param {{ reutilizarLeituras?: boolean }} [opcoes] Só use dentro da trava que fez as leituras. */
    function carregarEstado(opcoes) {
      const reutilizar = Boolean(opcoes && opcoes.reutilizarLeituras);
      if (!reutilizar) ultimasTabelas.clear();
      const ler = function (tabela) {
        return reutilizar && ultimasTabelas.has(tabela) ? ultimasTabelas.get(tabela) : lerAtual(tabela);
      };
      const dobra = dobrarOperacoes(ler('OPERACOES_LOG'));
      const linhasProdutos = ler('PRODUTOS');
      const linhasMovimentos = ler('MOVIMENTOS_ESTOQUE');
      const linhasFornecedores = ler('FORNECEDORES');
      const linhasAlteracoes = ler('PRODUTOS_ALTERACOES');
      // Bases anteriores à Fase 2 não têm estas tabelas: a leitura vazia vale zero vendas.
      const linhasVendas = ler('VENDAS');
      const linhasItens = ler('ITENS_VENDA');
      const linhasEstornos = ler('ESTORNOS_VENDA');
      conferirOrigem('PRODUTOS', linhasProdutos, dobra.operacoes);
      conferirOrigem('MOVIMENTOS_ESTOQUE', linhasMovimentos, dobra.operacoes);
      conferirOrigem('FORNECEDORES', linhasFornecedores, dobra.operacoes);
      conferirOrigem('PRODUTOS_ALTERACOES', linhasAlteracoes, dobra.operacoes);
      conferirOrigem('VENDAS', linhasVendas, dobra.operacoes);
      conferirOrigem('ITENS_VENDA', linhasItens, dobra.operacoes);
      conferirOrigem('ESTORNOS_VENDA', linhasEstornos, dobra.operacoes);

      // Operação confirmada precisa ter TODOS os registros da sua lista gravados.
      const linhasPorTabela = { PRODUTOS: linhasProdutos, MOVIMENTOS_ESTOQUE: linhasMovimentos, FORNECEDORES: linhasFornecedores, PRODUTOS_ALTERACOES: linhasAlteracoes,
        VENDAS: linhasVendas, ITENS_VENDA: linhasItens, ESTORNOS_VENDA: linhasEstornos };
      const presentes = {};
      Object.keys(linhasPorTabela).forEach(function (tabela) {
        const chave = PULSO.esquema.TABELAS[tabela].chave;
        presentes[tabela] = new Set(linhasPorTabela[tabela].map(function (l) { return l[chave]; }));
      });
      const pendentes = [];
      dobra.operacoes.forEach(function (operacao) {
        if (operacao.estado !== 'CONFIRMADA') pendentes.push(operacao);
        else if (!operacao.registros.every(function (r) { return presentes[r.tabela].has(r.linha[PULSO.esquema.TABELAS[r.tabela].chave]); })) {
          throw inconsistente('operação confirmada ' + operacao.operacaoId + ' sem todos os registros correspondentes');
        }
      });

      const produtos = new Map();
      const fornecedores = new Map();
      const versoes = new Map();
      /** @type {LinhaMovimento[]} */
      const movimentos = [];
      const saldos = new Map();
      const movimentados = new Set();
      /** venda_id -> { venda, itens, movimentos, estorno } */
      const vendas = new Map();
      // Reproduz a ordem das operações, incluindo o cadastro vigente em cada instante.
      dobra.operacoes.forEach(function (operacao) {
        if (operacao.estado !== 'CONFIRMADA') return;
        if (operacao.tipo === 'CONTAGEM_INVENTARIO') conferirItensContados(operacao, produtos, saldos);
        if (operacao.tipo === 'VENDA') conferirVendaNoEstado(operacao, produtos, saldos);
        if (operacao.tipo === 'ESTORNO_VENDA') conferirEstornoNoEstado(operacao, vendas);
        operacao.registros.forEach(function (registro) { reproduzirRegistro(operacao, registro); });
      });

      function reproduzirRegistro(operacao, registro) {
        const linha = registro.linha;
        if (registro.tabela === 'VENDAS') vendas.set(linha.venda_id, { venda: linha, itens: [], movimentos: [], estorno: null });
        else if (registro.tabela === 'ITENS_VENDA') vendas.get(linha.venda_id).itens.push(linha);
        else if (registro.tabela === 'ESTORNOS_VENDA') vendas.get(linha.venda_id).estorno = linha;
        else {
          reproduzir(operacao, linha);
          if (linha.tipo === 'VENDA' || linha.tipo === 'ESTORNO') vendas.get(linha.referencia_id).movimentos.push(linha);
        }
      }

      function reproduzir(operacao, linha) {
        if (operacao.tipo === 'CADASTRO_FORNECEDOR') {
          fornecedores.set(linha.fornecedor_id, linha);
        } else if (operacao.tipo === 'CADASTRO_PRODUTO') {
          if (linha.fornecedor_id && !fornecedores.has(linha.fornecedor_id)) throw inconsistente('produto vinculado a fornecedor inexistente');
          produtos.set(linha.sku, linha);
          versoes.set(linha.sku, [{ produto: Object.assign({}, linha), operacaoId: linha.operacao_id,
            alteracaoId: null, motivo: 'Cadastro inicial', registradoEm: linha.criado_em, operadorSimulado: null }]);
        } else if (operacao.tipo === 'ALTERACAO_PRODUTO') {
          const produto = produtos.get(linha.sku);
          if (!produto) throw inconsistente('alteração de produto inexistente');
          const pedido = JSON.parse(operacao.assinatura);
          const campos = PULSO.alteracao.efeito(produto, pedido.campos);
          if (!Object.keys(campos).length || PULSO.alteracao.canonico(campos) !== linha.campos_json) throw inconsistente('alteração sem efeito ou com campos divergentes');
          const resultado = PULSO.alteracao.aplicar(produto, campos, linha.registrado_em);
          if (!resultado.ok || (resultado.produto.fornecedor_id && !fornecedores.has(resultado.produto.fornecedor_id))) throw inconsistente('versão de produto inválida');
          produtos.set(linha.sku, resultado.produto);
          versoes.get(linha.sku).push({ produto: Object.assign({}, resultado.produto), operacaoId: linha.operacao_id,
            alteracaoId: linha.alteracao_id, motivo: linha.motivo, registradoEm: linha.registrado_em, operadorSimulado: linha.operador_simulado });
        } else {
          // Regras pelo tipo do movimento: uma contagem de inventário grava vários AJUSTE.
          const tipoMovimento = linha.tipo;
          const produto = produtos.get(linha.sku);
          const saldo = saldos.get(linha.sku) || 0;
          if (!produto) throw inconsistente('movimento ' + linha.movimento_id + ' anterior ao cadastro do SKU');
          if (tipoMovimento === 'ENTRADA' && !produto.ativo) throw inconsistente('entrada registrada em produto inativo');
          if (tipoMovimento === 'ENTRADA' && (!fornecedores.has(linha.fornecedor_id) || !fornecedores.get(linha.fornecedor_id).ativo)) throw inconsistente('entrada vinculada a fornecedor inexistente ou inativo');
          if (tipoMovimento === 'SALDO_INICIAL' && movimentados.has(linha.sku)) throw inconsistente('saldo inicial após movimentação');
          if (['PERDA', 'AJUSTE'].indexOf(tipoMovimento) !== -1 && linha.custo_unit_centavos !== produto.custo_ref_centavos) throw inconsistente('custo histórico divergente do cadastro vigente');
          if (tipoMovimento === 'AJUSTE' && (linha.saldo_anterior !== saldo || linha.saldo_novo !== saldo + linha.delta_unidades)) throw inconsistente('ajuste com saldos divergentes');
          movimentos.push(linha);
          saldos.set(linha.sku, saldo + linha.delta_unidades);
          movimentados.add(linha.sku);
        }
      }
      conferirMovimentos(movimentos);

      return {
        produtos: produtos,
        fornecedores: fornecedores,
        versoes: versoes,
        vendas: vendas,
        movimentos: movimentos,
        saldos: saldos,
        operacoesPorRequisicao: dobra.porRequisicao,
        pendentes: pendentes,
      };
    }

    function existe(tabela, valorChave) {
      const chave = PULSO.esquema.TABELAS[tabela].chave;
      const linhas = ultimasTabelas.has(tabela) ? ultimasTabelas.get(tabela) : lerAtual(tabela);
      return linhas.some(function (linha) { return linha[chave] === valorChave; });
    }

    /** Só retorna depois de reler a tabela e conferir o conteúdo completo da linha. */
    function anexarVerificado(tabela, linha) {
      armazenamento.anexar(tabela, linha);
      const esquema = PULSO.esquema;
      const chave = esquema.TABELAS[tabela].chave;
      const gravadas = lerAtual(tabela).filter(function (gravada) { return gravada[chave] === linha[chave]; });
      if (gravadas.length !== 1 || esquema.canonica(tabela, gravadas[0]) !== esquema.canonica(tabela, linha)) {
        throw PULSO.erros.criarExcecao('FALHA_GRAVACAO', 'A gravação em ' + tabela + ' não foi confirmada na releitura.');
      }
    }

    return { carregarEstado: carregarEstado, existe: existe, anexarVerificado: anexarVerificado };
  }

  return { criar: criar };
}
PULSO.repositorio = pulsoCriarRepositorio();
