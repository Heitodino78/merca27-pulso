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
        ['PRODUTOS', 'MOVIMENTOS_ESTOQUE', 'FORNECEDORES'].indexOf(payload.tabela) === -1) {
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
          evento.tentativas < 1 || ['CADASTRO_PRODUTO', 'ENTRADA', 'CADASTRO_FORNECEDOR'].indexOf(evento.tipo) === -1) {
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

  function confirmadas(linhas, operacoes) {
    return linhas.filter(function (linha) {
      return operacoes.get(linha.operacao_id).estado === 'CONFIRMADA';
    });
  }

  function conferirMovimentos(movimentos, produtos) {
    const saldos = new Map();
    movimentos.forEach(function (movimento) {
      if (!produtos.has(movimento.sku)) throw inconsistente('movimento ' + movimento.movimento_id + ' de SKU sem cadastro');
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
    function carregarEstado() {
      const dobra = dobrarOperacoes(lerTabela(armazenamento, 'OPERACOES_LOG'));
      const linhasProdutos = lerTabela(armazenamento, 'PRODUTOS');
      const linhasMovimentos = lerTabela(armazenamento, 'MOVIMENTOS_ESTOQUE');
      const linhasFornecedores = lerTabela(armazenamento, 'FORNECEDORES');
      conferirOrigem('PRODUTOS', linhasProdutos, dobra.operacoes);
      conferirOrigem('MOVIMENTOS_ESTOQUE', linhasMovimentos, dobra.operacoes);
      conferirOrigem('FORNECEDORES', linhasFornecedores, dobra.operacoes);

      const presentes = new Set(linhasProdutos.concat(linhasMovimentos, linhasFornecedores).map(function (l) { return l.operacao_id; }));
      const pendentes = [];
      dobra.operacoes.forEach(function (operacao) {
        if (operacao.estado !== 'CONFIRMADA') pendentes.push(operacao);
        else if (!presentes.has(operacao.operacaoId)) {
          throw inconsistente('operação confirmada ' + operacao.operacaoId + ' sem o registro correspondente');
        }
      });

      const produtos = new Map();
      confirmadas(linhasProdutos, dobra.operacoes).forEach(function (p) { produtos.set(p.sku, p); });
      const fornecedores = new Map();
      confirmadas(linhasFornecedores, dobra.operacoes).forEach(function (f) { fornecedores.set(f.fornecedor_id, f); });
      produtos.forEach(function (p) {
        if (p.fornecedor_id && !fornecedores.has(p.fornecedor_id)) throw inconsistente('produto vinculado a fornecedor inexistente');
      });
      const movimentos = confirmadas(linhasMovimentos, dobra.operacoes);
      conferirMovimentos(movimentos, produtos);
      movimentos.forEach(function (m) {
        if (m.tipo === 'ENTRADA' && (!fornecedores.has(m.fornecedor_id) || !fornecedores.get(m.fornecedor_id).ativo)) {
          throw inconsistente('entrada vinculada a fornecedor inexistente ou inativo');
        }
      });

      return {
        produtos: produtos,
        fornecedores: fornecedores,
        movimentos: movimentos,
        operacoesPorRequisicao: dobra.porRequisicao,
        pendentes: pendentes,
      };
    }

    function existe(tabela, valorChave) {
      const chave = PULSO.esquema.TABELAS[tabela].chave;
      return armazenamento.ler(tabela).some(function (linha) { return linha[chave] === valorChave; });
    }

    /** Só retorna depois de reler a tabela e conferir o conteúdo completo da linha. */
    function anexarVerificado(tabela, linha) {
      armazenamento.anexar(tabela, linha);
      const esquema = PULSO.esquema;
      const chave = esquema.TABELAS[tabela].chave;
      const gravadas = lerTabela(armazenamento, tabela).filter(function (gravada) { return gravada[chave] === linha[chave]; });
      if (gravadas.length !== 1 || esquema.canonica(tabela, gravadas[0]) !== esquema.canonica(tabela, linha)) {
        throw PULSO.erros.criarExcecao('FALHA_GRAVACAO', 'A gravação em ' + tabela + ' não foi confirmada na releitura.');
      }
    }

    return { carregarEstado: carregarEstado, existe: existe, anexarVerificado: anexarVerificado };
  }

  return { criar: criar };
}
PULSO.repositorio = pulsoCriarRepositorio();
