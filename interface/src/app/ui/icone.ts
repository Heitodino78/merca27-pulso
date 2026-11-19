import { Component, computed, input } from '@angular/core';

/*
 * Ícones próprios do PULSO, desenhados em traço sobre grade 24×24. Sem biblioteca externa:
 * o HTML único continua sem dependências de rede. Sempre decorativos (aria-hidden); o texto
 * ao lado ou o aria-label do botão dá o significado.
 */
const TRACOS: Record<string, string[]> = {
  painel: ['M3 13h7V3H3z', 'M14 21h7v-8h-7z', 'M14 3h7v6h-7z', 'M3 21h7v-4H3z'],
  produtos: ['M21 8 12 3 3 8v8l9 5 9-5z', 'M3 8l9 5 9-5', 'M12 13v8'],
  vendas: ['M3 4h2l2.4 11.2a2 2 0 0 0 2 1.6h7.7a2 2 0 0 0 2-1.5L21 8H6.2', 'M9 21h.01', 'M18 21h.01'],
  entrada: ['M12 3v12', 'M7 10l5 5 5-5', 'M4 19h16'],
  reposicao: ['M12 3 2 20h20z', 'M12 10v4', 'M12 17h.01'],
  fornecedores: ['M2 7h11v9H2z', 'M13 10h4l4 3v3h-8z', 'M6 19a2 2 0 1 0 0-.01', 'M17 19a2 2 0 1 0 0-.01'],
  busca: ['M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14z', 'M21 21l-4.3-4.3'],
  menu: ['M4 6h16', 'M4 12h16', 'M4 18h16'],
  fechar: ['M6 6l12 12', 'M18 6 6 18'],
  info: ['M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z', 'M12 11v5', 'M12 8h.01'],
  seta: ['M5 12h14', 'M13 6l6 6-6 6'],
  atualizar: ['M20 11a8 8 0 0 0-14.6-4.5L4 8', 'M4 3v5h5', 'M4 13a8 8 0 0 0 14.6 4.5L20 16', 'M20 21v-5h-5'],
  tabela: ['M3 5h18v14H3z', 'M3 10h18', 'M3 15h18', 'M9 5v14'],
  grafico: ['M4 20V10', 'M10 20V4', 'M16 20v-7', 'M22 20H2'],
  mais: ['M12 5v14', 'M5 12h14'],
  calendario: ['M4 6h16v14H4z', 'M4 10h16', 'M8 3v4', 'M16 3v4'],
};

export const NOMES_ICONES = Object.keys(TRACOS);

@Component({
  selector: 'pulso-icone',
  template: `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
         aria-hidden="true" focusable="false" class="size-full">
      @for (d of tracos(); track $index) { <path [attr.d]="d" /> }
    </svg>
  `,
  // Sem tamanho fixo: quem usa informa (size-4, size-5…), evitando classes conflitantes.
  host: { class: 'inline-block shrink-0 align-middle' },
})
export class Icone {
  readonly nome = input.required<string>();
  protected readonly tracos = computed(() => TRACOS[this.nome()] ?? []);
}
