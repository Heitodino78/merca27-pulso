import { Injectable } from '@angular/core';
import { ControleEnvio } from './envio';
import type { ResultadoGravacao } from './pulso-api';

/**
 * Mantém os controles de envio durante a sessão, por formulário. Assim, sair da página
 * depois de uma falha incerta não perde a chave: ao voltar, a repetição continua
 * disponível com a mesma requisicaoId. Envios concluídos começam do zero.
 * Recarregar a página encerra a sessão (limitação registrada em D-045).
 */
@Injectable({ providedIn: 'root' })
export class RegistroEnvios {
  private readonly controles = new Map<string, ControleEnvio<object, unknown>>();

  obter<D extends object, R>(chave: string, executar: (pedido: D & { requisicaoId: string }) => Promise<ResultadoGravacao<R>>): ControleEnvio<D, R> {
    const existente = this.controles.get(chave) as ControleEnvio<D, R> | undefined;
    if (existente) {
      const fase = existente.estado().fase;
      if (!existente.podeRepetir && fase !== 'conflito' && fase !== 'enviando') existente.novaTentativa();
      return existente;
    }
    const novo = new ControleEnvio<D, R>(executar);
    this.controles.set(chave, novo as unknown as ControleEnvio<object, unknown>);
    return novo;
  }
}
