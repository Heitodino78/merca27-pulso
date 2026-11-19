import { computed, signal } from '@angular/core';
import type { ErroPulso } from './contratos';
import type { ResultadoGravacao } from './pulso-api';

export type EstadoEnvio<R> =
  | { fase: 'ocioso' }
  | { fase: 'enviando'; repeticao: boolean }
  | { fase: 'sucesso'; resposta: R }
  | { fase: 'rejeitado'; erro: ErroPulso }
  | { fase: 'incerto'; erro: ErroPulso }
  | { fase: 'conflito'; erro: ErroPulso }
  | { fase: 'pendente'; erro: ErroPulso };

interface Tentativa<D> {
  requisicaoId: string;
  dados: D;
  /**
   * Dados do último envio desta chave que terminou sem certeza. Enquanto existir,
   * a chave não é descartada sozinha e `repetir()` reenvia exatamente esses dados.
   */
  dadosIncertos: D | null;
}

/** Chave única por tentativa lógica; aceita pelo padrão de requisição do núcleo. */
export function gerarRequisicaoId(): string {
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === 'function') return `UI-${c.randomUUID()}`;
  const bytes = new Uint8Array(16);
  c.getRandomValues(bytes);
  return `UI-${Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')}`;
}

/**
 * Controla o envio de um formulário de gravação.
 *
 * - Uma tentativa lógica tem uma única chave (requisicaoId). Ela é criada no primeiro
 *   envio e mantida até um resultado definitivo: sucesso, ou recusa antes de gravar
 *   quando nenhum envio anterior com essa chave ficou sem resposta.
 * - Depois de uma falha incerta, `repetir()` reenvia a MESMA chave com os MESMOS dados.
 *   Um novo envio com dados diferentes também usa a mesma chave: se a primeira tentativa
 *   tiver sido gravada, o núcleo responde REQUISICAO_CONFLITANTE em vez de duplicar.
 * - Enquanto há um envio em andamento, novos envios são ignorados (clique duplo).
 * - Sucesso só é declarado quando o núcleo devolve ok: true, ou seja, após a confirmação.
 */
export class ControleEnvio<D extends object, R = unknown> {
  readonly estado = signal<EstadoEnvio<R>>({ fase: 'ocioso' });
  readonly enviando = computed(() => this.estado().fase === 'enviando');
  private tentativa: Tentativa<D> | null = null;

  constructor(
    private readonly executar: (pedido: D & { requisicaoId: string }) => Promise<ResultadoGravacao<R>>,
    private readonly gerarId: () => string = gerarRequisicaoId,
  ) {}

  /** Chave da tentativa em curso, exibida quando a repetição é necessária. */
  get requisicaoId(): string | null {
    return this.tentativa?.requisicaoId ?? null;
  }

  enviar(dados: D): Promise<boolean> {
    if (this.enviando()) return Promise.resolve(false);
    this.tentativa = this.tentativa
      ? { ...this.tentativa, dados }
      : { requisicaoId: this.gerarId(), dados, dadosIncertos: null };
    return this.disparar(false);
  }

  /** Há um envio sem resposta definitiva que pode ser repetido com a mesma chave. */
  get podeRepetir(): boolean {
    return this.tentativa !== null && (this.tentativa.dadosIncertos !== null || this.estado().fase === 'pendente');
  }

  /** Reenvia o envio sem resposta definitiva: mesma chave, mesmos dados. */
  repetir(): Promise<boolean> {
    if (this.enviando() || !this.tentativa) return Promise.resolve(false);
    const dados = this.tentativa.dadosIncertos ?? this.tentativa.dados;
    this.tentativa = { ...this.tentativa, dados };
    return this.disparar(true);
  }

  /** Abandona a tentativa atual (após conflito ou ao começar outro lançamento). */
  novaTentativa(): void {
    if (this.enviando()) return;
    this.tentativa = null;
    this.estado.set({ fase: 'ocioso' });
  }

  private async disparar(repeticao: boolean): Promise<boolean> {
    const tentativa = this.tentativa;
    if (!tentativa) return false;
    this.estado.set({ fase: 'enviando', repeticao });
    const resultado = await this.executar({ ...tentativa.dados, requisicaoId: tentativa.requisicaoId });
    if (resultado.ok) {
      this.tentativa = null;
      this.estado.set({ fase: 'sucesso', resposta: resultado.valor });
      return true;
    }
    switch (resultado.certeza) {
      case 'nada-gravado':
        // Se um envio anterior desta chave pode ter sido gravado, a chave continua valendo:
        // uma chave nova poderia duplicar aquele lançamento.
        if (tentativa.dadosIncertos === null) this.tentativa = null;
        this.estado.set({ fase: 'rejeitado', erro: resultado.erro });
        break;
      case 'conflito':
        this.estado.set({ fase: 'conflito', erro: resultado.erro });
        break;
      case 'pendente':
        this.estado.set({ fase: 'pendente', erro: resultado.erro });
        break;
      default:
        tentativa.dadosIncertos = tentativa.dados;
        this.estado.set({ fase: 'incerto', erro: resultado.erro });
    }
    return false;
  }
}
