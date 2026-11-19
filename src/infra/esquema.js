/* Esquema das tabelas (futuras abas da planilha), com colunas em ordem fixa. */
var PULSO = PULSO || {};

PULSO.esquema = (function () {
  const INSTANTE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

  const TABELAS = {
    PRODUTOS: {
      chave: 'sku',
      colunas: [
        ['sku', 'texto'], ['nome', 'texto'], ['categoria_id', 'texto'], ['unidade', 'texto'],
        ['preco_venda_centavos', 'inteiro'], ['custo_ref_centavos', 'inteiro'],
        ['estoque_minimo', 'inteiro'], ['estoque_alvo', 'inteiro'], ['fornecedor_id', 'texto?'],
        ['ativo', 'booleano'], ['criado_em', 'instante'], ['atualizado_em', 'instante'],
        ['operacao_id', 'texto'],
      ],
    },
    MOVIMENTOS_ESTOQUE: {
      chave: 'movimento_id',
      colunas: [
        ['movimento_id', 'texto'], ['operacao_id', 'texto'], ['sku', 'texto'], ['tipo', 'texto'],
        ['delta_unidades', 'inteiro'], ['motivo', 'texto?'], ['referencia_id', 'texto?'],
        ['registrado_em', 'instante'], ['operador_simulado', 'texto'],
      ],
    },
    OPERACOES_LOG: {
      chave: 'evento_id',
      colunas: [
        ['evento_id', 'texto'], ['operacao_id', 'texto'], ['requisicao_id', 'texto?'], ['tipo', 'texto'],
        ['estado', 'texto'], ['registrado_em', 'instante'], ['resumo', 'texto'], ['referencia_id', 'texto?'],
        ['erro_cod', 'texto?'], ['tentativas', 'inteiro'], ['assinatura', 'texto?'], ['payload', 'texto?'],
      ],
    },
  };

  function tipoConfere(valor, tipo) {
    switch (tipo) {
      case 'texto': return typeof valor === 'string' && valor.length > 0;
      case 'texto?': return valor === null || (typeof valor === 'string' && valor.length > 0);
      case 'inteiro': return PULSO.validacao.inteiroSeguro(valor);
      case 'booleano': return typeof valor === 'boolean';
      case 'instante': return typeof valor === 'string' && INSTANTE.test(valor) && !isNaN(Date.parse(valor));
      default: return false;
    }
  }

  /** Retorna a descrição do problema ou null se a linha respeitar o esquema. */
  function problemaLinha(tabela, linha) {
    if (!PULSO.validacao.eObjeto(linha)) return 'linha não é um registro';
    const colunas = TABELAS[tabela].colunas;
    if (Object.keys(linha).length !== colunas.length) return 'quantidade de colunas incorreta';
    for (let i = 0; i < colunas.length; i++) {
      if (!Object.prototype.hasOwnProperty.call(linha, colunas[i][0])) return 'coluna ausente: ' + colunas[i][0];
      if (!tipoConfere(linha[colunas[i][0]], colunas[i][1])) return 'valor inválido na coluna ' + colunas[i][0];
    }
    return null;
  }

  /** Representação canônica, independente da ordem das chaves, para comparar registros. */
  function canonica(tabela, linha) {
    return JSON.stringify(TABELAS[tabela].colunas.map(function (coluna) { return linha[coluna[0]]; }));
  }

  return { TABELAS: TABELAS, problemaLinha: problemaLinha, canonica: canonica };
})();
