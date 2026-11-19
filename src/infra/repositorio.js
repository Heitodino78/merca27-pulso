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

  function abrirIntencao(evento) {
    let payload;
    try {
      payload = JSON.parse(evento.payload);
    } catch (e) {
      throw inconsistente('operação ' + evento.operacao_id + ' com payload ilegível');
    }
    if (!PULSO.validacao.eObjeto(payload) || Object.keys(payload).length !== 2 ||
        ['PRODUTOS', 'MOVIMENTOS_ESTOQUE', 'FORNECEDORES', 'PRODUTOS_ALTERACOES'].indexOf(payload.tabela) === -1) {
      throw inconsistente('operação ' + evento.operacao_id + ' com payload inválido');
    }
    const problema = PULSO.esquema.problemaLinha(payload.tabela, payload.linha);
    if (problema) throw inconsistente('operação ' + evento.operacao_id + ': ' + problema);
    if (!PULSO.validacao.requisicaoValida(evento.requisicao_id) || !evento.assinatura) {
      throw inconsistente('operação ' + evento.operacao_id + ' sem requisição ou assinatura');
    }
    conferirIntencao(evento, payload);
    return {
      operacaoId: evento.operacao_id,
      requisicaoId: evento.requisicao_id,
      tipo: evento.tipo,
      estado: evento.estado,
      tentativas: evento.tentativas,
      assinatura: evento.assinatura,
      tabela: payload.tabela,
      linha: payload.linha,
    };
  }

  /** A intenção recuperável precisa respeitar as mesmas regras do pedido original. */
  function conferirIntencao(evento, payload) {
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
          evento.tentativas < 1 || ['CADASTRO_PRODUTO', 'ENTRADA', 'CADASTRO_FORNECEDOR', 'ALTERACAO_PRODUTO', 'SALDO_INICIAL', 'PERDA', 'AJUSTE'].indexOf(evento.tipo) === -1) {
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
      const chave = PULSO.esquema.TABELAS[operacao.tabela].chave;
      if (evento.tipo !== operacao.tipo || evento.requisicao_id !== operacao.requisicaoId ||
          evento.referencia_id !== operacao.linha[chave] || evento.tentativas < operacao.tentativas ||
          evento.assinatura !== null || evento.payload !== null ||
          (evento.estado === 'CONFIRMADA' ? evento.erro_cod !== null : evento.erro_cod !== 'FALHA_GRAVACAO')) {
        throw inconsistente('operação ' + evento.operacao_id + ' com evento divergente da intenção');
      }
      operacao.estado = evento.estado;
      operacao.tentativas = evento.tentativas;
    });
    return { operacoes: operacoes, porRequisicao: porRequisicao };
  }

  /** Cada linha de dado precisa corresponder exatamente à operação que a originou. */
  function conferirOrigem(tabela, linhas, operacoes) {
    const esquema = PULSO.esquema;
    const chave = esquema.TABELAS[tabela].chave;
    linhas.forEach(function (linha) {
      const operacao = operacoes.get(linha.operacao_id);
      if (!operacao || operacao.tabela !== tabela || operacao.linha[chave] !== linha[chave]) {
        throw inconsistente(tabela + ': registro ' + linha[chave] + ' sem operação de origem');
      }
      if (esquema.canonica(tabela, linha) !== esquema.canonica(tabela, operacao.linha)) {
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
      conferirOrigem('PRODUTOS', linhasProdutos, dobra.operacoes);
      conferirOrigem('MOVIMENTOS_ESTOQUE', linhasMovimentos, dobra.operacoes);
      conferirOrigem('FORNECEDORES', linhasFornecedores, dobra.operacoes);
      conferirOrigem('PRODUTOS_ALTERACOES', linhasAlteracoes, dobra.operacoes);

      const presentes = new Set(linhasProdutos.concat(linhasMovimentos, linhasFornecedores, linhasAlteracoes).map(function (l) { return l.operacao_id; }));
      const pendentes = [];
      dobra.operacoes.forEach(function (operacao) {
        if (operacao.estado !== 'CONFIRMADA') pendentes.push(operacao);
        else if (!presentes.has(operacao.operacaoId)) {
          throw inconsistente('operação confirmada ' + operacao.operacaoId + ' sem o registro correspondente');
        }
      });

      const produtos = new Map();
      const fornecedores = new Map();
      const versoes = new Map();
      /** @type {LinhaMovimento[]} */
      const movimentos = [];
      const saldos = new Map();
      const movimentados = new Set();
      // Reproduz a ordem das operações, incluindo o cadastro vigente em cada instante.
      dobra.operacoes.forEach(function (operacao) {
        if (operacao.estado !== 'CONFIRMADA') return;
        const linha = operacao.linha;
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
          const produto = produtos.get(linha.sku);
          const saldo = saldos.get(linha.sku) || 0;
          if (!produto) throw inconsistente('movimento ' + linha.movimento_id + ' anterior ao cadastro do SKU');
          if (operacao.tipo === 'ENTRADA' && !produto.ativo) throw inconsistente('entrada registrada em produto inativo');
          if (operacao.tipo === 'ENTRADA' && (!fornecedores.has(linha.fornecedor_id) || !fornecedores.get(linha.fornecedor_id).ativo)) throw inconsistente('entrada vinculada a fornecedor inexistente ou inativo');
          if (operacao.tipo === 'SALDO_INICIAL' && movimentados.has(linha.sku)) throw inconsistente('saldo inicial após movimentação');
          if (['PERDA', 'AJUSTE'].indexOf(operacao.tipo) !== -1 && linha.custo_unit_centavos !== produto.custo_ref_centavos) throw inconsistente('custo histórico divergente do cadastro vigente');
          if (operacao.tipo === 'AJUSTE' && (linha.saldo_anterior !== saldo || linha.saldo_novo !== saldo + linha.delta_unidades)) throw inconsistente('ajuste com saldos divergentes');
          movimentos.push(linha);
          saldos.set(linha.sku, saldo + linha.delta_unidades);
          movimentados.add(linha.sku);
        }
      });
      conferirMovimentos(movimentos);

      return {
        produtos: produtos,
        fornecedores: fornecedores,
        versoes: versoes,
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
