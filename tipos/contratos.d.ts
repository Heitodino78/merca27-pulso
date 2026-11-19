/** Contratos de fronteira. Declarações apagadas em runtime; nenhuma API do Node. */
interface PedidoCadastro {
  requisicaoId?: string; sku: string; nome: string; categoria: string; unidade?: string;
  precoVendaCentavos: number; custoRefCentavos: number; estoqueMinimo: number; estoqueAlvo: number;
  fornecedorId?: string | null; ativo?: boolean;
}
interface PedidoEntrada {
  requisicaoId?: string; sku: string; quantidade: number;
  custoUnitCentavos: number; fornecedorId: string;
  referenciaFornecedor?: string | null; motivo?: string | null; operadorSimulado?: string;
}
interface DadosMovimentoAdministrativo {
  sku: string; motivo: string; operadorSimulado: string; quantidade?: number;
  quantidadeContada?: number; custoUnitCentavos?: number; categoriaPerda?: string;
}
interface PedidoFornecedor {
  requisicaoId?: string; fornecedorId: string; nomeFicticio: string; categoriaPrincipal: string; prazoEstimadoDias: number; ativo?: boolean;
}
interface PedidoAlteracao {
  requisicaoId?: string; sku: string; motivo: string; operadorSimulado?: string;
  campos: Partial<Pick<PedidoCadastro, 'nome' | 'categoria' | 'precoVendaCentavos' | 'custoRefCentavos' | 'estoqueMinimo' | 'estoqueAlvo' | 'fornecedorId' | 'ativo'>>;
}
interface PedidoStatus { requisicaoId?: string; sku: string; motivo: string; operadorSimulado?: string; }
interface PedidoSaldoInicial extends PedidoStatus { quantidade: number; custoUnitCentavos: number; }
interface PedidoPerda extends PedidoStatus { quantidade: number; categoriaPerda: string; }
interface PedidoAjuste extends PedidoStatus { quantidadeContada: number; }
interface PedidoConsulta { sku: string; limiteHistorico?: number; }
interface LinhaProduto {
  sku: string; nome: string; categoria_id: string; unidade: string;
  preco_venda_centavos: number; custo_ref_centavos: number;
  estoque_minimo: number; estoque_alvo: number; fornecedor_id: string | null; ativo: boolean;
  criado_em: string; atualizado_em: string; operacao_id: string;
}
interface LinhaMovimento {
  movimento_id: string; operacao_id: string; sku: string; tipo: string; delta_unidades: number;
  motivo: string | null; referencia_id: string | null; registrado_em: string; operador_simulado: string;
  custo_unit_centavos: number | null; fornecedor_id: string | null; categoria_perda: string | null;
  saldo_anterior: number | null; saldo_novo: number | null;
}
interface LinhaFornecedor {
  fornecedor_id: string; nome_ficticio: string; categoria_principal: string; prazo_estimado_dias: number;
  ativo: boolean; criado_em: string; operacao_id: string;
}
interface LinhaAlteracao {
  alteracao_id: string; operacao_id: string; sku: string; campos_json: string; motivo: string;
  registrado_em: string; operador_simulado: string;
}
interface LinhaEvento {
  evento_id: string; operacao_id: string; requisicao_id: string | null; tipo: string; estado: string;
  registrado_em: string; resumo: string; referencia_id: string | null; erro_cod: string | null;
  tentativas: number; assinatura: string | null; payload: string | null;
}
interface ErroPulso { codigo: string; mensagem: string; detalhes?: object; }
interface FalhaPulso { ok: false; erro: ErroPulso; }
interface RespostaOperacao {
  ok: boolean; erro?: ErroPulso; duplicada?: boolean; recuperada?: boolean;
  operacaoId?: string; movimentoId?: string; sku?: string; quantidade?: number; saldoAtual?: number;
  mensagem?: string; aviso?: string;
}
type LinhaPulso = LinhaProduto | LinhaMovimento | LinhaEvento | LinhaFornecedor | LinhaAlteracao;
interface ArmazenamentoPulso {
  ler(tabela: string): LinhaPulso[];
  anexar(tabela: string, linha: LinhaPulso): void;
}
interface LockPulso { executar<T>(funcao: () => T): T; }
interface PortasPulso {
  armazenamento: ArmazenamentoPulso; lock: LockPulso;
  relogio(): string; gerarId(prefixo: string): string;
}
interface PulsoNucleo {
  criar: typeof pulsoCriar;
  erros: ReturnType<typeof pulsoCriarErros>;
  validacao: ReturnType<typeof pulsoCriarValidacao>;
  produto: ReturnType<typeof pulsoCriarProduto>;
  fornecedor: ReturnType<typeof pulsoCriarFornecedor>;
  alteracao: ReturnType<typeof pulsoCriarAlteracao>;
  movimento: ReturnType<typeof pulsoCriarMovimento>;
  estoque: ReturnType<typeof pulsoCriarEstoque>;
  esquema: ReturnType<typeof pulsoCriarEsquema>;
  repositorio: ReturnType<typeof pulsoCriarRepositorio>;
  operacoes: ReturnType<typeof pulsoCriarOperacoes>;
  casosDeUso: ReturnType<typeof pulsoCriarCasosDeUso>;
}
