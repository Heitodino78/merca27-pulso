import type { ErroPulso } from './contratos';

/**
 * Como apresentar uma falha ao usuário. Não decide regras de negócio: só traduz
 * o código devolvido pelo núcleo em "o que se sabe sobre a gravação".
 *
 * - nada-gravado: o núcleo recusou antes de gravar; corrigir e enviar de novo é seguro.
 * - incerto: pode ter sido gravado; repetir com a MESMA chave e os MESMOS dados.
 * - conflito: a chave já foi usada com outros dados; nada foi alterado agora.
 * - pendente: há operação anterior por reconciliar; nenhum lançamento novo começou.
 */
export type Certeza = 'nada-gravado' | 'incerto' | 'conflito' | 'pendente';

/** Códigos que o núcleo só devolve antes de gravar qualquer coisa. */
const RECUSAS_ANTES_DE_GRAVAR = new Set([
  'ACAO_DESCONHECIDA', 'REQUISICAO_INVALIDA', 'DADOS_INVALIDOS', 'SKU_INVALIDO', 'QTD_INVALIDA',
  'SKU_INEXISTENTE', 'SKU_DUPLICADO', 'SKU_INATIVO', 'FORNECEDOR_INEXISTENTE', 'FORNECEDOR_INATIVO',
  'ALTERACAO_SEM_MUDANCA', 'SALDO_INICIAL_INDEVIDO', 'SALDO_INSUFICIENTE', 'AJUSTE_SEM_DIFERENCA',
  'LOCK_OCUPADO',
]);

/** Para gravações. Qualquer código desconhecido é tratado como incerto, por segurança. */
export function classificarFalhaGravacao(erro: ErroPulso): Certeza {
  if (erro.codigo === 'REQUISICAO_CONFLITANTE') return 'conflito';
  if (erro.codigo === 'RECONCILIACAO_PENDENTE') return 'pendente';
  if (RECUSAS_ANTES_DE_GRAVAR.has(erro.codigo)) return 'nada-gravado';
  return 'incerto';
}
