'use strict';
/* Apoio aos testes: armazenamento em memória com injeção de falhas e relógio/IDs determinísticos. */
const { carregarNucleo } = require('../local/nucleo');

function criarArmazenamentoMemoria() {
  const tabelas = { PRODUTOS: [], MOVIMENTOS_ESTOQUE: [], OPERACOES_LOG: [], FORNECEDORES: [], PRODUTOS_ALTERACOES: [] };
  const falhas = [];
  return {
    tabelas,
    /** modo: 'antes' (lança sem gravar), 'depois' (grava e lança), 'silencioso' (descarta sem avisar). */
    falharNaProxima(tabela, modo, filtro = () => true) {
      falhas.push({ tabela, modo, filtro });
    },
    ler: (tabela) => tabelas[tabela].map((linha) => ({ ...linha })),
    anexar(tabela, linha) {
      const indice = falhas.findIndex((f) => f.tabela === tabela && f.filtro(linha));
      const falha = indice >= 0 ? falhas.splice(indice, 1)[0] : null;
      if (falha?.modo === 'antes') throw new Error('falha simulada antes da escrita');
      if (falha?.modo === 'silencioso') return;
      tabelas[tabela].push({ ...linha });
      if (falha?.modo === 'depois') throw new Error('falha simulada depois da escrita');
    },
  };
}

function criarAmbiente() {
  const armazenamento = criarArmazenamentoMemoria();
  let sequencia = 0;
  const pulso = carregarNucleo().criar({
    armazenamento,
    lock: { executar: (funcao) => funcao() },
    relogio: () => new Date(Date.UTC(2026, 10, 18, 12, 0, sequencia)).toISOString(),
    gerarId: (prefixo) => `${prefixo}-${String(++sequencia).padStart(6, '0')}`,
  });
  pulso.cadastrarFornecedor({ requisicaoId: 'REQ-FOR-001', fornecedorId: 'FOR-001', nomeFicticio: 'Fornecedor Fictício', categoriaPrincipal: 'MERCEARIA', prazoEstimadoDias: 2 });
  return { pulso, armazenamento };
}

const PRODUTO_BASE = Object.freeze({
  requisicaoId: 'REQ-CAD-001',
  sku: 'MER-001',
  nome: 'Produto Fictício de Teste',
  categoria: 'MERCEARIA',
  precoVendaCentavos: 990,
  custoRefCentavos: 600,
  estoqueMinimo: 5,
  estoqueAlvo: 12,
});

function ambienteComProduto() {
  const ambiente = criarAmbiente();
  const resultado = ambiente.pulso.cadastrarProduto({ ...PRODUTO_BASE });
  if (!resultado.ok) throw new Error(`preparação falhou: ${resultado.erro.codigo}`);
  return ambiente;
}

/** Eventos de um estado no log, para asserções de auditoria. */
const eventos = (armazenamento, estado) => armazenamento.tabelas.OPERACOES_LOG.filter((e) => e.estado === estado);

/** Soma independente da implementação: considera só operações com evento CONFIRMADA. */
function saldoRecalculado(armazenamento, sku) {
  const confirmadas = new Set(eventos(armazenamento, 'CONFIRMADA').map((e) => e.operacao_id));
  return armazenamento.tabelas.MOVIMENTOS_ESTOQUE
    .filter((m) => m.sku === sku && confirmadas.has(m.operacao_id))
    .reduce((total, m) => total + m.delta_unidades, 0);
}

/**
 * Formatos do payload da intenção: 'legado' é o { tabela, linha } gravado até a Fase 01;
 * 'atual' é o { registros: [...] } de M-03. Testes de adulteração rodam nos dois.
 */
const FORMATOS = ['legado', 'atual'];

/** Edita o primeiro registro da intenção e regrava o payload no formato pedido. */
function editarPayload(evento, formato, alterar) {
  const lido = JSON.parse(evento.payload);
  const registros = lido.registros ? lido.registros : [lido];
  alterar(registros[0]);
  evento.payload = JSON.stringify(formato === 'legado' ? registros[0] : { registros });
  return registros[0];
}

module.exports = { criarAmbiente, ambienteComProduto, PRODUTO_BASE, eventos, saldoRecalculado, FORMATOS, editarPayload };
