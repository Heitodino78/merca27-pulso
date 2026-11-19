/*
 * Espelho de tipos/contratos.d.ts e das respostas dos casos de uso em src/.
 * Apenas formatos: nenhuma regra de negócio é repetida aqui.
 */

export interface ErroPulso {
  codigo: string;
  mensagem: string;
  detalhes?: Record<string, unknown>;
}

export interface Falha {
  ok: false;
  erro: ErroPulso;
}

export type Resposta<T> = (T & { ok: true }) | Falha;

export const CATEGORIAS = ['BEBIDAS', 'MERCEARIA', 'LATICINIOS', 'SNACKS', 'HIGIENE', 'LIMPEZA'] as const;
export const CATEGORIAS_PERDA = ['AVARIA', 'VENCIMENTO', 'QUEBRA'] as const;

export interface ProdutoResumo {
  sku: string;
  nome: string;
  categoria: string;
  precoVendaCentavos: number;
  custoRefCentavos: number;
  fornecedorId: string | null;
  atualizadoEm: string;
  ativo: boolean;
  saldoAtual: number;
  estoqueMinimo: number;
  estoqueAlvo: number;
}

export interface ListaProdutos {
  produtos: ProdutoResumo[];
  operacoesPendentes: number;
}

export interface LinhaFornecedor {
  fornecedor_id: string;
  nome_ficticio: string;
  categoria_principal: string;
  prazo_estimado_dias: number;
  ativo: boolean;
  criado_em: string;
  operacao_id: string;
}

export interface ListaFornecedores {
  fornecedores: LinhaFornecedor[];
  operacoesPendentes: number;
}

export interface MovimentoHistorico {
  movimentoId: string;
  operacaoId: string;
  tipo: string;
  deltaUnidades: number;
  saldoApos: number;
  motivo: string | null;
  referenciaId: string | null;
  registradoEm: string;
  operadorSimulado: string;
  custoUnitCentavos: number | null;
  fornecedorId: string | null;
  categoriaPerda: string | null;
  saldoAnterior: number | null;
  saldoNovo: number | null;
}

export interface ConsultaEstoque {
  sku: string;
  nome: string;
  categoria: string;
  unidade: string;
  ativo: boolean;
  precoVendaCentavos: number;
  custoRefCentavos: number;
  fornecedorId: string | null;
  criadoEm: string;
  atualizadoEm: string;
  saldoAtual: number;
  estoqueMinimo: number;
  estoqueAlvo: number;
  totalMovimentos: number;
  historico: MovimentoHistorico[];
  operacoesPendentes: number;
}

export interface LinhaProduto {
  sku: string;
  nome: string;
  categoria_id: string;
  unidade: string;
  preco_venda_centavos: number;
  custo_ref_centavos: number;
  estoque_minimo: number;
  estoque_alvo: number;
  fornecedor_id: string | null;
  ativo: boolean;
  criado_em: string;
  atualizado_em: string;
  operacao_id: string;
}

export interface VersaoProduto {
  produto: LinhaProduto;
  operacaoId: string;
  alteracaoId: string | null;
  motivo: string;
  registradoEm: string;
  operadorSimulado: string | null;
}

export interface HistoricoProduto {
  sku: string;
  versoes: VersaoProduto[];
}

export interface ItemReposicao {
  sku: string;
  nome: string;
  saldoAtual: number;
  estoqueMinimo: number;
  estoqueAlvo: number;
  sugestaoUnidades: number;
  fornecedor: LinhaFornecedor | null;
  regra: string;
}

export interface ConsultaReposicao {
  itens: ItemReposicao[];
  operacoesPendentes: number;
  aviso: string;
}

export interface RespostaGravacao {
  operacaoId: string;
  mensagem: string;
  duplicada?: boolean;
  recuperada?: boolean;
  aviso?: string;
  sku?: string;
  movimentoId?: string;
  quantidade?: number;
  saldoAtual?: number;
}

export interface RespostaReconciliacao {
  reconciliadas: string[];
}

export interface PedidoCadastro {
  requisicaoId: string;
  sku: string;
  nome: string;
  categoria: string;
  precoVendaCentavos: number;
  custoRefCentavos: number;
  estoqueMinimo: number;
  estoqueAlvo: number;
  fornecedorId: string | null;
  ativo?: boolean;
}

export type CampoAlteravel =
  | 'nome' | 'categoria' | 'precoVendaCentavos' | 'custoRefCentavos'
  | 'estoqueMinimo' | 'estoqueAlvo' | 'fornecedorId';

export interface PedidoAlteracao {
  requisicaoId: string;
  sku: string;
  motivo: string;
  campos: Partial<Record<CampoAlteravel, string | number | null>>;
}

export interface PedidoStatus {
  requisicaoId: string;
  sku: string;
  motivo: string;
}

export interface PedidoEntrada {
  requisicaoId: string;
  sku: string;
  quantidade: number;
  custoUnitCentavos: number;
  fornecedorId: string;
  referenciaFornecedor?: string;
  motivo?: string;
}

export interface PedidoSaldoInicial extends PedidoStatus {
  quantidade: number;
  custoUnitCentavos: number;
}

export interface PedidoPerda extends PedidoStatus {
  quantidade: number;
  categoriaPerda: string;
}

export interface PedidoAjuste extends PedidoStatus {
  quantidadeContada: number;
}

export const FORMAS_PAGAMENTO = ['DINHEIRO', 'PIX', 'CARTAO'] as const;

export interface PedidoVenda {
  requisicaoId: string;
  itens: { sku: string; quantidade: number }[];
  formaPagamentoFicticia: string;
  observacao?: string;
}

export interface PedidoEstorno {
  requisicaoId: string;
  vendaId: string;
  motivo: string;
}

export interface RespostaVenda extends RespostaGravacao {
  vendaId: string;
  totalCentavos: number;
  custoEstCentavos: number;
  formaPagamento: string;
  itens: { sku: string; quantidade: number; precoUnitCentavos: number; subtotalCentavos: number; saldoAtual: number }[];
}

export interface RespostaEstorno extends RespostaGravacao {
  estornoId: string;
  vendaId: string;
  devolvidos: { sku: string; quantidade: number; saldoAtual: number }[];
}

export interface ResumoVenda {
  vendaId: string;
  requisicaoId: string;
  registradoEm: string;
  formaPagamento: string;
  totalCentavos: number;
  custoEstCentavos: number;
  observacao: string | null;
  operadorSimulado: string;
  quantidadeItens: number;
  estado: 'CONFIRMADA' | 'ESTORNADA';
}

export interface ListaVendas {
  vendas: ResumoVenda[];
  operacoesPendentes: number;
}

export interface DetalheVenda {
  venda: ResumoVenda;
  itens: { itemId: string; sku: string; quantidade: number; precoUnitCentavos: number; custoUnitEstCentavos: number; subtotalCentavos: number }[];
  movimentos: { movimentoId: string; tipo: string; sku: string; deltaUnidades: number; registradoEm: string }[];
  estorno: { estornoId: string; registradoEm: string; motivo: string; operadorSimulado: string } | null;
  operacoesPendentes: number;
}

export interface FiltroVendas {
  desde?: string;
  ate?: string;
  limite?: number;
}

/* Fase 3: indicadores por período (src/domain/indicadores.js). */

export interface SerieDia {
  dia: string;
  receitaBrutaCentavos: number;
  devolucoesCentavos: number;
  numeroVendas: number;
  unidadesVendidas: number;
  perdasUnidades: number;
}

export interface ProdutoRanking {
  sku: string;
  nome: string;
  unidadesVendidas: number;
  receitaBrutaCentavos: number;
  cmvCentavos: number;
  unidadesDevolvidas: number;
  devolvidoCentavos: number;
}

export interface FormulasIndicadores {
  receitaBruta: string;
  devolucoes: string;
  receitaAposDevolucoes: string;
  cmvEstimado: string;
  margemBruta: string;
  margemPercentual: string;
  ticketMedio: string;
  perdas: string;
  valorEstoque: string;
}

export interface Indicadores {
  periodo: { desde: string; ate: string; fuso: string; primeiroDia: string; ultimoDia: string; regra: string };
  vendas: { numero: number; unidades: number; receitaBrutaCentavos: number; cmvCentavos: number; estornadasDepois: number };
  devolucoes: { numero: number; unidades: number; valorCentavos: number; cmvCentavos: number; deVendasAnteriores: number };
  resultado: {
    receitaBrutaCentavos: number;
    devolucoesCentavos: number;
    receitaAposDevolucoesCentavos: number;
    cmvEstimadoCentavos: number;
    margemBrutaCentavos: number;
    margemPercentual: number | null;
    ticketMedioCentavos: number | null;
  };
  perdas: { unidades: number; valorCentavos: number; porCategoria: Record<string, { unidades: number; valorCentavos: number }> };
  ajustes: { numero: number; unidadesAcrescidas: number; unidadesRetiradas: number; valorLiquidoCentavos: number };
  entradas: { numero: number; unidades: number; valorCentavos: number };
  estoqueAtual: { valorCentavos: number; unidades: number; produtosAtivos: number; abaixoDoMinimo: number; semEstoque: number };
  serie: SerieDia[];
  produtosMaisVendidos: ProdutoRanking[];
  totalSkusVendidos: number;
  origem: { vendaIds: string[]; estornoIds: string[]; movimentosPerda: string[] };
  formulas: FormulasIndicadores;
  reposicao: { quantidade: number; itens: ItemReposicao[] };
  operacoesPendentes: number;
  avisos: string[];
}

/** Ações expostas pelo despacho do núcleo (src/application/despacho.js). */
export type AcaoPulso =
  | 'listarProdutos' | 'listarFornecedores' | 'consultarReposicao' | 'reconciliarPendencias'
  | 'consultarEstoque' | 'consultarHistoricoProduto'
  | 'cadastrarProduto' | 'alterarProduto' | 'desativarProduto' | 'reativarProduto'
  | 'registrarEntrada' | 'registrarSaldoInicial' | 'registrarPerda' | 'ajustarPorContagem'
  | 'confirmarVenda' | 'estornarVenda' | 'listarVendas' | 'consultarVenda'
  | 'consultarIndicadores';
