import { Component, input } from '@angular/core';

/**
 * Rótulo, dica e erro de um campo. O controle projetado deve usar
 * [id]="id" e [attr.aria-describedby]="descricao" do mesmo id.
 */
@Component({
  selector: 'pulso-campo',
  template: `
    <label [for]="id()" class="rotulo">
      {{ rotulo() }}
      @if (opcional()) { <span class="font-normal text-suave">(opcional)</span> }
    </label>
    <ng-content />
    @if (dica()) {
      <p [id]="id() + '-dica'" class="dica">{{ dica() }}</p>
    }
    @if (erro()) {
      <p [id]="id() + '-erro'" class="erro-campo">{{ erro() }}</p>
    }
  `,
  host: { class: 'block' },
})
export class Campo {
  readonly id = input.required<string>();
  readonly rotulo = input.required<string>();
  readonly dica = input<string | null>(null);
  readonly erro = input<string | null>(null);
  readonly opcional = input(false);
}

/** Valor de aria-describedby que aponta para a dica e, se houver, para o erro. */
export function descricao(id: string, temDica: boolean, temErro: boolean): string | null {
  const ids = [temDica ? `${id}-dica` : '', temErro ? `${id}-erro` : ''].filter(Boolean);
  return ids.length ? ids.join(' ') : null;
}
