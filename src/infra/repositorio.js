/*
 * Repositório sobre uma porta de armazenamento somente-acréscimo:
 *   armazenamento.ler(tabela) -> linhas
 *   armazenamento.anexar(tabela, linha)
 * A porta não oferece editar nem apagar: o histórico não pode ser reescrito pelo fluxo normal.
 */
var PULSO = PULSO || {};

PULSO.repositorio = (function () {
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
    if (!PULSO.validacao.eObjeto(payload) || !PULSO.esquema.TABELAS[payload.tabela]) {
      throw inconsistente('operação ' + evento.operacao_id + ' com payload inválido');
    }
    const problema = PULSO.esquema.problemaLinha(payload.tabela, payload.linha);
    if (problema) throw inconsistente('operação ' + evento.operacao_id + ': ' + problema);
    if (!evento.requisicao_id || !evento.assinatura) {
      throw inconsistente('operação ' + evento.operacao_id + ' sem requisição ou assinatura');
    }
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

  /** O log é uma sequência de eventos; o estado de cada operação é o último evento dela. */
  function dobrarOperacoes(eventos) {
    const operacoes = new Map();
    const porRequisicao = new Map();
    eventos.forEach(function (evento) {
      if (evento.estado === 'REJEITADA') return;
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
      saldos.set(movimento.sku, saldo);
    });
  }

  function criar(armazenamento) {
    function carregarEstado() {
      const dobra = dobrarOperacoes(lerTabela(armazenamento, 'OPERACOES_LOG'));
      const linhasProdutos = lerTabela(armazenamento, 'PRODUTOS');
      const linhasMovimentos = lerTabela(armazenamento, 'MOVIMENTOS_ESTOQUE');
      conferirOrigem('PRODUTOS', linhasProdutos, dobra.operacoes);
      conferirOrigem('MOVIMENTOS_ESTOQUE', linhasMovimentos, dobra.operacoes);

      const presentes = new Set(linhasProdutos.concat(linhasMovimentos).map(function (l) { return l.operacao_id; }));
      const pendentes = [];
      dobra.operacoes.forEach(function (operacao) {
        if (operacao.estado !== 'CONFIRMADA') pendentes.push(operacao);
        else if (!presentes.has(operacao.operacaoId)) {
          throw inconsistente('operação confirmada ' + operacao.operacaoId + ' sem o registro correspondente');
        }
      });

      const produtos = new Map();
      confirmadas(linhasProdutos, dobra.operacoes).forEach(function (p) { produtos.set(p.sku, p); });
      const movimentos = confirmadas(linhasMovimentos, dobra.operacoes);
      conferirMovimentos(movimentos, produtos);

      return {
        produtos: produtos,
        movimentos: movimentos,
        operacoesPorRequisicao: dobra.porRequisicao,
        pendentes: pendentes,
      };
    }

    function existe(tabela, valorChave) {
      const chave = PULSO.esquema.TABELAS[tabela].chave;
      return armazenamento.ler(tabela).some(function (linha) { return linha[chave] === valorChave; });
    }

    /** Só retorna depois de reler a tabela e encontrar a linha gravada. */
    function anexarVerificado(tabela, linha) {
      armazenamento.anexar(tabela, linha);
      if (!existe(tabela, linha[PULSO.esquema.TABELAS[tabela].chave])) {
        throw PULSO.erros.criarExcecao('FALHA_GRAVACAO', 'A gravação em ' + tabela + ' não foi confirmada na releitura.');
      }
    }

    return { carregarEstado: carregarEstado, existe: existe, anexarVerificado: anexarVerificado };
  }

  return { criar: criar };
})();
