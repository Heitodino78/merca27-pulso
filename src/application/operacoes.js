/*
 * Executor de operações de escrita. Sheets não tem transação entre abas, então cada
 * operação segue três gravações: intenção PENDENTE -> dado -> evento CONFIRMADA.
 * Se algo falhar no meio, a repetição com a mesma requisição conclui o que faltou.
 */
/** @type {PulsoNucleo} */
var PULSO = PULSO || /** @type {PulsoNucleo} */ ({});

function pulsoCriarOperacoes() {
  const LOG = 'OPERACOES_LOG';

  function traduzirExcecao(excecao) {
    if (excecao && excecao.codigo) return PULSO.erros.falha(excecao.codigo, excecao.message);
    return PULSO.erros.falha('FALHA_GRAVACAO', 'Não foi possível verificar a conclusão. Consulte o estado e repita com o mesmo identificador de requisição.');
  }

  function comLock(ctx, funcao) {
    try {
      return ctx.lock.executar(funcao);
    } catch (excecao) {
      return traduzirExcecao(excecao);
    }
  }

  function linhaEvento(ctx, campos) {
    return {
      evento_id: ctx.gerarId('EVT'),
      operacao_id: campos.operacaoId,
      requisicao_id: campos.requisicaoId,
      tipo: campos.tipo,
      estado: campos.estado,
      registrado_em: ctx.relogio(),
      resumo: campos.resumo,
      referencia_id: campos.referenciaId === undefined ? null : campos.referenciaId,
      erro_cod: campos.erroCod === undefined ? null : campos.erroCod,
      tentativas: campos.tentativas,
      assinatura: campos.assinatura === undefined ? null : campos.assinatura,
      payload: campos.payload === undefined ? null : campos.payload,
    };
  }

  /** O registro da rejeição é auxiliar: se falhar, a resposta ao usuário continua sendo a rejeição. */
  function rejeitar(ctx, tipo, requisicaoId, resultado) {
    try {
      ctx.repositorio.anexarVerificado(LOG, linhaEvento(ctx, {
        operacaoId: ctx.gerarId('OPR'),
        requisicaoId: requisicaoId,
        tipo: tipo,
        estado: 'REJEITADA',
        resumo: resultado.erro.mensagem,
        erroCod: resultado.erro.codigo,
        tentativas: 1,
      }));
    } catch (ignorada) { /* rejeição não altera dados */ }
    return resultado;
  }

  /** Conclui uma operação pendente sem duplicar o dado, mesmo que ele já tenha sido gravado. */
  function concluir(ctx, operacao) {
    const chave = PULSO.esquema.TABELAS[operacao.tabela].chave;
    if (!ctx.repositorio.existe(operacao.tabela, operacao.linha[chave])) {
      ctx.repositorio.anexarVerificado(operacao.tabela, operacao.linha);
    }
    ctx.repositorio.anexarVerificado(LOG, linhaEvento(ctx, {
      operacaoId: operacao.operacaoId,
      requisicaoId: operacao.requisicaoId,
      tipo: operacao.tipo,
      estado: 'CONFIRMADA',
      resumo: 'Operação concluída por reconciliação.',
      referenciaId: operacao.linha[chave],
      tentativas: operacao.tentativas + 1,
    }));
  }

  function gravarNova(ctx, def, requisicaoId, assinatura, dados) {
    const operacaoId = ctx.gerarId('OPR');
    const registro = def.construir(dados, operacaoId, ctx.relogio());
    const chave = PULSO.esquema.TABELAS[registro.tabela].chave;
    const base = {
      operacaoId: operacaoId,
      requisicaoId: requisicaoId,
      tipo: def.tipo,
      referenciaId: registro.linha[chave],
    };
    let podeMarcarInterrupcao = false;
    try {
      ctx.repositorio.anexarVerificado(LOG, linhaEvento(ctx, Object.assign({}, base, {
        estado: 'PENDENTE',
        resumo: 'Intenção registrada.',
        tentativas: 1,
        assinatura: assinatura,
        payload: JSON.stringify(registro),
      })));
      podeMarcarInterrupcao = true;
      ctx.repositorio.anexarVerificado(registro.tabela, registro.linha);
      // A confirmação pode ter sido gravada mesmo com erro de retorno: nada mais pode ser
      // anexado depois dela. A intenção PENDENTE já basta para a recuperação.
      podeMarcarInterrupcao = false;
      ctx.repositorio.anexarVerificado(LOG, linhaEvento(ctx, Object.assign({}, base, {
        estado: 'CONFIRMADA',
        resumo: 'Operação confirmada.',
        tentativas: 1,
      })));
      return null;
    } catch (excecao) {
      if (podeMarcarInterrupcao) {
        try {
          ctx.repositorio.anexarVerificado(LOG, linhaEvento(ctx, Object.assign({}, base, {
            estado: 'PENDENTE_RECONCILIACAO',
            resumo: 'Gravação interrompida; aguardando reconciliação.',
            erroCod: 'FALHA_GRAVACAO',
            tentativas: 1,
          })));
        } catch (ignorada) { /* a intenção PENDENTE já permite a recuperação */ }
      }
      return PULSO.erros.falha(
        'FALHA_GRAVACAO',
        'A gravação não foi confirmada. Repita a operação com o mesmo identificador de requisição.',
        { requisicaoId: requisicaoId }
      );
    }
  }

  function responderConfirmada(def, estado, requisicaoId, situacao) {
    const operacao = estado.operacoesPorRequisicao.get(requisicaoId);
    if (!operacao || operacao.estado !== 'CONFIRMADA') {
      return PULSO.erros.falha('FALHA_GRAVACAO', 'A operação continua pendente. Repita com o mesmo identificador de requisição.');
    }
    return def.responder(estado, operacao, situacao);
  }

  /**
   * def: { tipo, normalizar(request), assinatura(dados), verificar(estado, dados),
   *        construir(dados, operacaoId, agora), responder(estado, operacao, situacao) }
   */
  /** @returns {RespostaOperacao} */
  function executar(ctx, def, request) {
    return comLock(ctx, function () {
      const v = PULSO.validacao;
      if (!v.eObjeto(request) || !v.requisicaoValida(request.requisicaoId)) {
        return rejeitar(ctx, def.tipo, null, PULSO.erros.falha(
          'REQUISICAO_INVALIDA', 'Informe um identificador de requisição válido (letras, números, ponto, dois-pontos, hífen ou sublinhado).'
        ));
      }
      const requisicaoId = request.requisicaoId;
      const normalizado = def.normalizar(request);
      if (!normalizado.ok) return rejeitar(ctx, def.tipo, requisicaoId, normalizado);

      const assinatura = JSON.stringify(def.assinatura(normalizado.dados));
      let estado = ctx.repositorio.carregarEstado();
      const anterior = estado.operacoesPorRequisicao.get(requisicaoId);

      if (anterior) {
        if (anterior.tipo !== def.tipo || anterior.assinatura !== assinatura) {
          return rejeitar(ctx, def.tipo, requisicaoId, PULSO.erros.falha(
            'REQUISICAO_CONFLITANTE', 'Este identificador de requisição já foi usado com dados diferentes. Nada foi alterado.'
          ));
        }
        if (anterior.estado === 'CONFIRMADA') return def.responder(estado, anterior, { duplicada: true, recuperada: false });
        concluir(ctx, anterior);
        estado = ctx.repositorio.carregarEstado();
        return responderConfirmada(def, estado, requisicaoId, { duplicada: false, recuperada: true });
      }

      if (estado.pendentes.length) {
        return rejeitar(ctx, def.tipo, requisicaoId, PULSO.erros.falha(
          'RECONCILIACAO_PENDENTE', 'Existe operação interrompida. Execute a reconciliação antes de novos lançamentos.',
          { requisicoes: estado.pendentes.map(function (p) { return p.requisicaoId; }) }
        ));
      }

      const recusa = def.verificar(estado, normalizado.dados);
      if (recusa) return rejeitar(ctx, def.tipo, requisicaoId, recusa);

      const falhaGravacao = gravarNova(ctx, def, requisicaoId, assinatura, normalizado.dados);
      if (falhaGravacao) return falhaGravacao;

      estado = ctx.repositorio.carregarEstado();
      return responderConfirmada(def, estado, requisicaoId, { duplicada: false, recuperada: false });
    });
  }

  function reconciliar(ctx) {
    return comLock(ctx, function () {
      const estado = ctx.repositorio.carregarEstado();
      estado.pendentes.forEach(function (operacao) { concluir(ctx, operacao); });
      const estadoFinal = ctx.repositorio.carregarEstado();
      if (estadoFinal.pendentes.length) {
        return PULSO.erros.falha('FALHA_GRAVACAO', 'A reconciliação não foi confirmada. Repita o comando reconciliar.');
      }
      return {
        ok: true,
        reconciliadas: estado.pendentes.map(function (operacao) { return operacao.requisicaoId; }),
      };
    });
  }

  function consultar(ctx, funcao) {
    return comLock(ctx, function () { return funcao(ctx.repositorio.carregarEstado()); });
  }

  return { executar: executar, reconciliar: reconciliar, consultar: consultar };
}
PULSO.operacoes = pulsoCriarOperacoes();
