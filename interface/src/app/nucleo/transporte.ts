import { InjectionToken } from '@angular/core';
import type { AcaoPulso } from './contratos';

/**
 * Falha de comunicação. `enviado` diz se a chamada pode ter chegado ao servidor:
 * quando é falso, há certeza de que nada foi gravado.
 */
export class FalhaTransporte extends Error {
  constructor(mensagem: string, readonly enviado: boolean) {
    super(mensagem);
    this.name = 'FalhaTransporte';
  }
}

export interface TransportePulso {
  chamar(acao: AcaoPulso, pedido?: object): Promise<unknown>;
}

interface ExecutorGoogle {
  withSuccessHandler(f: (valor: unknown) => void): ExecutorGoogle;
  withFailureHandler(f: (erro: unknown) => void): ExecutorGoogle;
  pulsoChamar(acao: string, pedido: object | null): void;
}

export interface JanelaComGoogle {
  google?: { script?: { run?: ExecutorGoogle } };
}

/**
 * Único transporte da interface: google.script.run. No Apps Script ele é real; na
 * pré-visualização local (local/servidor-preview.js) é simulado com a mesma forma.
 */
export function criarTransporteAppsScript(janela: JanelaComGoogle): TransportePulso {
  return {
    chamar(acao, pedido) {
      return new Promise((resolver, rejeitar) => {
        const run = janela.google?.script?.run;
        if (!run) {
          rejeitar(new FalhaTransporte('Servidor indisponível: google.script.run não existe neste ambiente.', false));
          return;
        }
        try {
          run
            .withSuccessHandler(resolver)
            .withFailureHandler((erro) => {
              const texto = erro instanceof Error ? erro.message : String(erro);
              rejeitar(new FalhaTransporte(texto || 'Falha de comunicação com o servidor.', true));
            })
            .pulsoChamar(acao, pedido ?? null);
        } catch (erro) {
          // Uma exceção síncrona acontece antes do envio.
          rejeitar(new FalhaTransporte(erro instanceof Error ? erro.message : 'Falha ao chamar o servidor.', false));
        }
      });
    },
  };
}

export const TRANSPORTE_PULSO = new InjectionToken<TransportePulso>('TRANSPORTE_PULSO', {
  providedIn: 'root',
  factory: () => criarTransporteAppsScript(globalThis as unknown as JanelaComGoogle),
});
