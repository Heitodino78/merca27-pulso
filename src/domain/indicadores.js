/*
 * Indicadores gerenciais por período (Fase 3). Funções puras sobre o estado já reproduzido e
 * validado pelo repositório: só entram operações CONFIRMADAS, nunca pendências.
 *
 * Política temporal (D-063): cada evento conta no período em que foi registrado.
 *   - Vendas brutas: vendas cujo registro está em [desde, ate), estornadas depois ou não.
 *   - Devoluções: estornos registrados em [desde, ate), com os valores capturados na venda original,
 *     mesmo que a venda seja de um período anterior.
 *   - Receita após devoluções = vendas brutas − devoluções do período; pode ser negativa.
 * Fuso (D-064): America/Sao_Paulo, sem horário de verão desde 2019, tratado como UTC−03:00.
 */
/** @type {PulsoNucleo} */
var PULSO = PULSO || /** @type {PulsoNucleo} */ ({});

function pulsoCriarIndicadores() {
  const FUSO = 'America/Sao_Paulo';
  const DESLOCAMENTO_MS = -3 * 60 * 60 * 1000;
  const DIA_MS = 24 * 60 * 60 * 1000;
  const LIMITE_DIAS = 366;
  const LIMITE_RANKING = 10;
  const INSTANTE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
  const DIA = /^\d{4}-\d{2}-\d{2}$/;
  const CATEGORIAS_PERDA = ['AVARIA', 'VENCIMENTO', 'QUEBRA'];

  const FORMULAS = {
    receitaBruta: 'Soma dos totais das vendas registradas no período, com o preço capturado em cada venda.',
    devolucoes: 'Soma dos totais das vendas estornadas no período, pela data do estorno (a venda pode ser de outro período).',
    receitaAposDevolucoes: 'Receita bruta − devoluções do período. Pode ser negativa se houver só estornos.',
    cmvEstimado: 'Σ quantidade × custo de referência capturado em cada venda, menos o custo das devoluções do período. Gerencial, não contábil.',
    margemBruta: 'Receita após devoluções − CMV estimado. Antes de despesas e tributos; não é lucro.',
    margemPercentual: 'Margem bruta ÷ receita após devoluções. N/D quando essa receita é zero ou negativa.',
    ticketMedio: 'Receita bruta ÷ número de vendas registradas no período. N/D sem vendas.',
    perdas: 'Unidades baixadas como perda no período × custo de referência gravado no movimento.',
    valorEstoque: 'Retrato ATUAL (não do fim do período): saldo de cada produto × custo de referência vigente.',
  };

  function instanteValido(valor) {
    return typeof valor === 'string' && INSTANTE.test(valor) && Number.isFinite(Date.parse(valor)) && new Date(valor).toISOString() === valor;
  }
  function diaValido(valor) {
    if (typeof valor !== 'string' || !DIA.test(valor)) return false;
    const instante = Date.parse(valor + 'T00:00:00.000Z');
    return Number.isFinite(instante) && new Date(instante).toISOString().slice(0, 10) === valor;
  }
  /** Dia civil em São Paulo de um instante UTC. */
  function diaLocal(instante) {
    return new Date(Date.parse(instante) + DESLOCAMENTO_MS).toISOString().slice(0, 10);
  }
  /** Instante UTC da meia-noite de um dia civil em São Paulo. */
  function inicioDoDia(dia) {
    return new Date(Date.parse(dia + 'T00:00:00.000Z') - DESLOCAMENTO_MS).toISOString();
  }
  function diaSeguinte(dia) {
    return new Date(Date.parse(dia + 'T00:00:00.000Z') + DIA_MS).toISOString().slice(0, 10);
  }

  /** Período em instantes UTC, início inclusivo e fim exclusivo, até 366 dias. */
  function normalizarPeriodo(request) {
    const v = PULSO.validacao;
    if (!v.eObjeto(request) || v.camposDesconhecidos(request, ['desde', 'ate']).length ||
        !instanteValido(request.desde) || !instanteValido(request.ate) || request.desde >= request.ate ||
        Date.parse(request.ate) - Date.parse(request.desde) > LIMITE_DIAS * DIA_MS) {
      return PULSO.erros.falha('DADOS_INVALIDOS', 'Informe desde e ate em instantes ISO UTC (AAAA-MM-DDTHH:MM:SS.mmmZ), desde < ate, em até ' + LIMITE_DIAS + ' dias.');
    }
    return { ok: true, dados: { desde: request.desde, ate: request.ate } };
  }

  /** Dia civil AAAA-MM-DD em São Paulo, convertido para o período UTC correspondente. */
  function normalizarDia(request) {
    const v = PULSO.validacao;
    if (!v.eObjeto(request) || v.camposDesconhecidos(request, ['dia']).length || !diaValido(request.dia)) {
      return PULSO.erros.falha('DADOS_INVALIDOS', 'Informe o dia no formato AAAA-MM-DD (fuso ' + FUSO + ').');
    }
    return { ok: true, dados: { dia: request.dia, desde: inicioDoDia(request.dia), ate: inicioDoDia(diaSeguinte(request.dia)) } };
  }

  function dentro(instante, periodo) {
    return instante >= periodo.desde && instante < periodo.ate;
  }

  /**
   * Agrega o estado validado no período. Devolve null se algum valor sair do intervalo de
   * inteiros exatos: nenhum indicador é arredondado em silêncio.
   */
  function agregar(estado, periodo) {
    const serie = new Map();
    const ultimoDia = diaLocal(new Date(Date.parse(periodo.ate) - 1).toISOString());
    for (let dia = diaLocal(periodo.desde); ; dia = diaSeguinte(dia)) {
      serie.set(dia, { dia: dia, receitaBrutaCentavos: 0, devolucoesCentavos: 0, numeroVendas: 0, unidadesVendidas: 0, perdasUnidades: 0 });
      if (dia === ultimoDia) break;
    }
    const balde = function (instante) { return serie.get(diaLocal(instante)); };

    const vendas = { numero: 0, receitaBrutaCentavos: 0, cmvCentavos: 0, unidades: 0, estornadasDepois: 0, ids: [] };
    const devolucoes = { numero: 0, valorCentavos: 0, cmvCentavos: 0, unidades: 0, deVendasAnteriores: 0, ids: [] };
    const porSku = new Map();
    const doSku = function (sku) {
      if (!porSku.has(sku)) porSku.set(sku, { sku: sku, unidadesVendidas: 0, receitaBrutaCentavos: 0, cmvCentavos: 0, unidadesDevolvidas: 0, devolvidoCentavos: 0 });
      return porSku.get(sku);
    };

    estado.vendas.forEach(function (registro) {
      const venda = registro.venda;
      if (dentro(venda.registrado_em, periodo)) {
        const unidades = registro.itens.reduce(function (s, i) { return s + i.quantidade; }, 0);
        vendas.numero++;
        vendas.receitaBrutaCentavos += venda.total_centavos;
        vendas.cmvCentavos += venda.custo_est_centavos;
        vendas.unidades += unidades;
        if (registro.estorno) vendas.estornadasDepois++;
        vendas.ids.push(venda.venda_id);
        const b = balde(venda.registrado_em);
        b.receitaBrutaCentavos += venda.total_centavos;
        b.numeroVendas++;
        b.unidadesVendidas += unidades;
        registro.itens.forEach(function (item) {
          const s = doSku(item.sku);
          s.unidadesVendidas += item.quantidade;
          s.receitaBrutaCentavos += item.subtotal_centavos;
          s.cmvCentavos += item.quantidade * item.custo_unit_est_centavos;
        });
      }
      if (registro.estorno && dentro(registro.estorno.registrado_em, periodo)) {
        devolucoes.numero++;
        devolucoes.valorCentavos += venda.total_centavos;
        devolucoes.cmvCentavos += venda.custo_est_centavos;
        devolucoes.unidades += registro.itens.reduce(function (s, i) { return s + i.quantidade; }, 0);
        if (venda.registrado_em < periodo.desde) devolucoes.deVendasAnteriores++;
        devolucoes.ids.push(registro.estorno.estorno_id);
        balde(registro.estorno.registrado_em).devolucoesCentavos += venda.total_centavos;
        registro.itens.forEach(function (item) {
          const s = doSku(item.sku);
          s.unidadesDevolvidas += item.quantidade;
          s.devolvidoCentavos += item.subtotal_centavos;
        });
      }
    });

    const perdas = { unidades: 0, valorCentavos: 0, porCategoria: {}, ids: [] };
    CATEGORIAS_PERDA.forEach(function (c) { perdas.porCategoria[c] = { unidades: 0, valorCentavos: 0 }; });
    const ajustes = { numero: 0, unidadesAcrescidas: 0, unidadesRetiradas: 0, valorLiquidoCentavos: 0 };
    const entradas = { numero: 0, unidades: 0, valorCentavos: 0 };
    estado.movimentos.forEach(function (m) {
      if (!dentro(m.registrado_em, periodo)) return;
      const custo = m.custo_unit_centavos || 0;
      if (m.tipo === 'PERDA') {
        const unidades = -m.delta_unidades;
        perdas.unidades += unidades;
        perdas.valorCentavos += unidades * custo;
        perdas.porCategoria[m.categoria_perda].unidades += unidades;
        perdas.porCategoria[m.categoria_perda].valorCentavos += unidades * custo;
        perdas.ids.push(m.movimento_id);
        balde(m.registrado_em).perdasUnidades += unidades;
      } else if (m.tipo === 'AJUSTE') {
        ajustes.numero++;
        if (m.delta_unidades > 0) ajustes.unidadesAcrescidas += m.delta_unidades;
        else ajustes.unidadesRetiradas -= m.delta_unidades;
        ajustes.valorLiquidoCentavos += m.delta_unidades * custo;
      } else if (m.tipo === 'ENTRADA') {
        entradas.numero++;
        entradas.unidades += m.delta_unidades;
        entradas.valorCentavos += m.delta_unidades * custo;
      }
    });

    const estoque = { valorCentavos: 0, unidades: 0, produtosAtivos: 0, abaixoDoMinimo: 0, semEstoque: 0 };
    estado.produtos.forEach(function (produto) {
      const saldo = estado.saldos.get(produto.sku) || 0;
      estoque.valorCentavos += saldo * produto.custo_ref_centavos;
      estoque.unidades += saldo;
      if (!produto.ativo) return;
      estoque.produtosAtivos++;
      if (saldo <= produto.estoque_minimo) estoque.abaixoDoMinimo++;
      if (saldo === 0) estoque.semEstoque++;
    });

    const receitaAposDevolucoes = vendas.receitaBrutaCentavos - devolucoes.valorCentavos;
    const cmvEstimado = vendas.cmvCentavos - devolucoes.cmvCentavos;
    const margemBruta = receitaAposDevolucoes - cmvEstimado;
    const resultado = {
      receitaBrutaCentavos: vendas.receitaBrutaCentavos,
      devolucoesCentavos: devolucoes.valorCentavos,
      receitaAposDevolucoesCentavos: receitaAposDevolucoes,
      cmvEstimadoCentavos: cmvEstimado,
      margemBrutaCentavos: margemBruta,
      margemPercentual: receitaAposDevolucoes > 0 ? Math.round(margemBruta * 10000 / receitaAposDevolucoes) / 100 : null,
      ticketMedioCentavos: vendas.numero > 0 ? Math.round(vendas.receitaBrutaCentavos / vendas.numero) : null,
    };

    const ranking = Array.from(porSku.values())
      .filter(function (s) { return s.unidadesVendidas > 0; })
      .sort(function (a, b) { return b.receitaBrutaCentavos - a.receitaBrutaCentavos || (a.sku < b.sku ? -1 : 1); })
      .map(function (s) {
        const produto = estado.produtos.get(s.sku);
        return Object.assign({ nome: produto ? produto.nome : s.sku }, s);
      });

    const inteiros = [vendas.receitaBrutaCentavos, vendas.cmvCentavos, vendas.unidades, devolucoes.valorCentavos, devolucoes.cmvCentavos,
      devolucoes.unidades, receitaAposDevolucoes, cmvEstimado, margemBruta, perdas.unidades, perdas.valorCentavos,
      ajustes.valorLiquidoCentavos, ajustes.unidadesAcrescidas, ajustes.unidadesRetiradas, entradas.unidades, entradas.valorCentavos,
      estoque.valorCentavos, estoque.unidades];
    porSku.forEach(function (s) { inteiros.push(s.receitaBrutaCentavos, s.cmvCentavos, s.devolvidoCentavos); });
    if (!inteiros.every(PULSO.validacao.inteiroSeguro)) return null;

    return {
      periodo: { desde: periodo.desde, ate: periodo.ate, fuso: FUSO, primeiroDia: diaLocal(periodo.desde), ultimoDia: ultimoDia,
        regra: 'Cada evento conta pela data em que foi registrado: vendas pela data da venda, devoluções pela data do estorno.' },
      vendas: { numero: vendas.numero, unidades: vendas.unidades, receitaBrutaCentavos: vendas.receitaBrutaCentavos,
        cmvCentavos: vendas.cmvCentavos, estornadasDepois: vendas.estornadasDepois },
      devolucoes: { numero: devolucoes.numero, unidades: devolucoes.unidades, valorCentavos: devolucoes.valorCentavos,
        cmvCentavos: devolucoes.cmvCentavos, deVendasAnteriores: devolucoes.deVendasAnteriores },
      resultado: resultado,
      perdas: { unidades: perdas.unidades, valorCentavos: perdas.valorCentavos, porCategoria: perdas.porCategoria },
      ajustes: ajustes,
      entradas: entradas,
      estoqueAtual: estoque,
      serie: Array.from(serie.values()),
      produtosMaisVendidos: ranking.slice(0, LIMITE_RANKING),
      totalSkusVendidos: ranking.length,
      origem: { vendaIds: vendas.ids, estornoIds: devolucoes.ids, movimentosPerda: perdas.ids },
      formulas: FORMULAS,
    };
  }

  /** Texto simples do resumo diário: o mesmo conteúdo que uma entrega futura enviaria. */
  function textoResumo(resumo) {
    const brl = function (c) {
      if (c === null) return 'N/D';
      const sinal = c < 0 ? '-' : '';
      const abs = Math.abs(c);
      const inteiros = String(Math.floor(abs / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
      return sinal + 'R$ ' + inteiros + ',' + String(abs % 100).padStart(2, '0');
    };
    const i = resumo.indicadores;
    const linhas = [
      'PULSO — resumo operacional de ' + resumo.dia + ' (' + FUSO + '). Dados fictícios.',
      (resumo.diaEmAndamento ? 'Dia ainda em andamento: valores parciais. ' : '') + 'Gerado em ' + resumo.geradoEm + '.',
      'Vendas: ' + i.vendas.numero + ' (' + i.vendas.unidades + ' un.), receita bruta ' + brl(i.resultado.receitaBrutaCentavos) + '.',
      'Devoluções: ' + i.devolucoes.numero + ', ' + brl(i.resultado.devolucoesCentavos) + '. Receita após devoluções ' + brl(i.resultado.receitaAposDevolucoesCentavos) + '.',
      'Margem bruta estimada: ' + brl(i.resultado.margemBrutaCentavos) + (i.resultado.margemPercentual === null ? ' (N/D %).' : ' (' + String(i.resultado.margemPercentual).replace('.', ',') + '%).'),
      'Perdas: ' + i.perdas.unidades + ' un., ' + brl(i.perdas.valorCentavos) + '. Entradas: ' + i.entradas.unidades + ' un.',
      'Reposição sugerida: ' + resumo.reposicao.length + ' produto(s)' + (resumo.reposicao.length ? ': ' + resumo.reposicao.map(function (r) { return r.sku + ' (+' + r.sugestaoUnidades + ')'; }).join(', ') : '') + '.',
      resumo.operacoesPendentes ? 'ATENÇÃO: ' + resumo.operacoesPendentes + ' operação(ões) pendente(s) de reconciliação, fora dos números.' : 'Sem operações pendentes.',
    ];
    return linhas.join('\n');
  }

  return {
    FUSO: FUSO, FORMULAS: FORMULAS, LIMITE_DIAS: LIMITE_DIAS,
    instanteValido: instanteValido, diaValido: diaValido, diaLocal: diaLocal, inicioDoDia: inicioDoDia, diaSeguinte: diaSeguinte,
    normalizarPeriodo: normalizarPeriodo, normalizarDia: normalizarDia, agregar: agregar, textoResumo: textoResumo,
  };
}
PULSO.indicadores = pulsoCriarIndicadores();
