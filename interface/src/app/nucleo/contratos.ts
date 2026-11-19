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

/** Ações expostas pelo despacho do núcleo (src/application/despacho.js). */
export type AcaoPulso =
  | 'listarProdutos' | 'listarFornecedores' | 'consultarReposicao' | 'reconciliarPendencias'
  | 'consultarEstoque' | 'consultarHistoricoProduto'
  | 'cadastrarProduto' | 'alterarProduto' | 'desativarProduto' | 'reativarProduto'
  | 'registrarEntrada' | 'registrarSaldoInicial' | 'registrarPerda' | 'ajustarPorContagem';
