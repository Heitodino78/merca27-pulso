import { Injectable, inject, signal } from '@angular/core';
import { classificarFalhaGravacao, type Certeza } from './classificacao';
import type {
  AcaoPulso, ConsultaEstoque, ConsultaReposicao, ErroPulso, HistoricoProduto, ListaFornecedores, ListaProdutos,
  PedidoAjuste, PedidoAlteracao, PedidoCadastro, PedidoEntrada, PedidoPerda, PedidoSaldoInicial, PedidoStatus,
  RespostaGravacao, RespostaReconciliacao,
} from './contratos';
import { FalhaTransporte, TRANSPORTE_PULSO } from './transporte';

export type ResultadoConsulta<T> = { ok: true; valor: T } | { ok: false; erro: ErroPulso };
export type ResultadoGravacao<T = RespostaGravacao> =
  | { ok: true; valor: T }
  | { ok: false; erro: ErroPulso; certeza: Certeza };

function eObjeto(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor);
}

/** Resposta sem o formato { ok, ... } esperado não prova nada sobre a gravação. */
function respostaMalformada(): ErroPulso {
  return { codigo: 'RESPOSTA_INVALIDA', mensagem: 'O servidor respondeu num formato inesperado.' };
}

/**
 * Fachada tipada sobre o despacho do núcleo. Não valida regras: repassa o pedido,
 * reconhece o formato da resposta e diz o que se sabe sobre a gravação.
 */
@Injectable({ providedIn: 'root' })
export class PulsoApi {
  private readonly transporte = inject(TRANSPORTE_PULSO);

  /** Última contagem de operações pendentes informada por qualquer consulta. */
  readonly operacoesPendentes = signal(0);

  private async consultar<T>(acao: AcaoPulso, pedido?: object): Promise<ResultadoConsulta<T>> {
    try {
      const resposta = await this.transporte.chamar(acao, pedido);
      if (!eObjeto(resposta) || typeof resposta['ok'] !== 'boolean') return { ok: false, erro: respostaMalformada() };
      if (resposta['ok'] === false) return { ok: false, erro: resposta['erro'] as ErroPulso };
      if (typeof resposta['operacoesPendentes'] === 'number') this.operacoesPendentes.set(resposta['operacoesPendentes']);
      return { ok: true, valor: resposta as T };
    } catch (erro) {
      return { ok: false, erro: { codigo: 'FALHA_COMUNICACAO', mensagem: erro instanceof Error ? erro.message : 'Falha de comunicação.' } };
    }
  }

  private async gravar<T = RespostaGravacao>(acao: AcaoPulso, pedido?: object): Promise<ResultadoGravacao<T>> {
    try {
      const resposta = await this.transporte.chamar(acao, pedido);
      if (!eObjeto(resposta) || typeof resposta['ok'] !== 'boolean') {
        return { ok: false, erro: respostaMalformada(), certeza: 'incerto' };
      }
      if (resposta['ok'] === false) {
        const erro = resposta['erro'] as ErroPulso;
        return { ok: false, erro, certeza: classificarFalhaGravacao(erro) };
      }
      return { ok: true, valor: resposta as T };
    } catch (erro) {
      const enviado = !(erro instanceof FalhaTransporte) || erro.enviado;
      return {
        ok: false,
        erro: { codigo: 'FALHA_COMUNICACAO', mensagem: erro instanceof Error ? erro.message : 'Falha de comunicação.' },
        certeza: enviado ? 'incerto' : 'nada-gravado',
      };
    }
  }

  listarProdutos() { return this.consultar<ListaProdutos>('listarProdutos'); }
  listarFornecedores() { return this.consultar<ListaFornecedores>('listarFornecedores'); }
  consultarReposicao() { return this.consultar<ConsultaReposicao>('consultarReposicao'); }
  consultarEstoque(sku: string, limiteHistorico?: number) {
    return this.consultar<ConsultaEstoque>('consultarEstoque', limiteHistorico === undefined ? { sku } : { sku, limiteHistorico });
  }
  consultarHistoricoProduto(sku: string) { return this.consultar<HistoricoProduto>('consultarHistoricoProduto', { sku }); }

  cadastrarProduto(p: PedidoCadastro) { return this.gravar('cadastrarProduto', p); }
  alterarProduto(p: PedidoAlteracao) { return this.gravar('alterarProduto', p); }
  desativarProduto(p: PedidoStatus) { return this.gravar('desativarProduto', p); }
  reativarProduto(p: PedidoStatus) { return this.gravar('reativarProduto', p); }
  registrarEntrada(p: PedidoEntrada) { return this.gravar('registrarEntrada', p); }
  registrarSaldoInicial(p: PedidoSaldoInicial) { return this.gravar('registrarSaldoInicial', p); }
  registrarPerda(p: PedidoPerda) { return this.gravar('registrarPerda', p); }
  ajustarPorContagem(p: PedidoAjuste) { return this.gravar('ajustarPorContagem', p); }

  async reconciliarPendencias(): Promise<ResultadoGravacao<RespostaReconciliacao>> {
    const resultado = await this.gravar<RespostaReconciliacao>('reconciliarPendencias');
    if (resultado.ok) this.operacoesPendentes.set(0);
    return resultado;
  }
}
