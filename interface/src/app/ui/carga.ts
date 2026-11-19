import { Component, input, output, signal } from '@angular/core';
import type { ErroPulso } from '../nucleo/contratos';
import type { ResultadoConsulta } from '../nucleo/pulso-api';

export type EstadoCarga<T> =
  | { fase: 'carregando' }
  | { fase: 'pronto'; valor: T }
  | { fase: 'falha'; erro: ErroPulso };

/** Estado de uma consulta, com recarga. Consultas nunca gravam: repetir é sempre seguro. */
export class Carga<T> {
  readonly estado = signal<EstadoCarga<T>>({ fase: 'carregando' });
  private versao = 0;

  constructor(private readonly buscar: () => Promise<ResultadoConsulta<T>>) {}

  /** Recarrega; respostas antigas que chegarem depois de uma nova busca são descartadas. */
  async carregar(manterValor = false): Promise<void> {
    const minha = ++this.versao;
    if (!manterValor || this.estado().fase !== 'pronto') this.estado.set({ fase: 'carregando' });
    const resultado = await this.buscar();
    if (minha !== this.versao) return;
    this.estado.set(resultado.ok ? { fase: 'pronto', valor: resultado.valor } : { fase: 'falha', erro: resultado.erro });
  }

  get valor(): T | null {
    const e = this.estado();
    return e.fase === 'pronto' ? e.valor : null;
  }
}

@Component({
  selector: 'pulso-carregando',
  template: `
    <div role="status" class="flex items-center gap-3 rounded-lg border border-borda bg-superficie p-4 text-sm text-suave">
      <span aria-hidden="true" class="inline-block size-4 rounded-full border-2 border-verde border-t-transparent motion-safe:animate-spin"></span>
      {{ texto() }}
    </div>
  `,
})
export class Carregando {
  readonly texto = input('Carregando…');
}

@Component({
  selector: 'pulso-falha-consulta',
  template: `
    <div role="alert" class="rounded-lg border-l-4 border-erro bg-erro-claro p-4 text-sm text-texto">
      <p class="font-bold text-erro">{{ titulo() }}</p>
      <p class="mt-1">{{ erro().mensagem }} <span class="text-suave">({{ erro().codigo }})</span></p>
      <p class="mt-1">Consultas não alteram dados: tentar de novo é seguro.</p>
      <button type="button" class="botao-secundario mt-3" (click)="tentarDeNovo.emit()">Tentar de novo</button>
    </div>
  `,
})
export class FalhaConsulta {
  readonly erro = input.required<ErroPulso>();
  readonly titulo = input('Não foi possível carregar os dados.');
  readonly tentarDeNovo = output<void>();
}

@Component({
  selector: 'pulso-vazio',
  template: `
    <div class="rounded-lg border border-dashed border-borda bg-superficie p-6 text-center">
      <p class="font-semibold text-texto">{{ titulo() }}</p>
      @if (texto()) { <p class="mt-1 text-sm text-suave">{{ texto() }}</p> }
      <div class="mt-3 flex justify-center"><ng-content /></div>
    </div>
  `,
})
export class Vazio {
  readonly titulo = input.required<string>();
  readonly texto = input<string | null>(null);
}
