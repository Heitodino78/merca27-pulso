import { Component, DestroyRef, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { formatarBRL, formatarInteiro } from '../nucleo/dinheiro';
import { Icone } from './icone';

export type FormatoKpi = 'brl' | 'inteiro' | 'pct';

const PERCENTUAL = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 });

/** Formata o valor do núcleo. null é "N/D": nunca vira zero. */
export function formatarKpi(valor: number | null, formato: FormatoKpi): string {
  if (valor === null || !Number.isFinite(valor)) return 'N/D';
  if (formato === 'brl') return formatarBRL(Math.round(valor));
  if (formato === 'pct') return `${PERCENTUAL.format(valor)}%`;
  return formatarInteiro(Math.round(valor));
}

/** Animações só quando o navegador permite e a pessoa não pediu movimento reduzido. */
export function movimentoPermitido(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function' && typeof requestAnimationFrame === 'function' &&
    !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

let contador = 0;

/**
 * Indicador com valor vindo do núcleo, fórmula acessível e link de detalhamento. O número
 * "corre" até o valor novo (apenas apresentação); o valor final exibido é sempre o do núcleo.
 */
@Component({
  selector: 'pulso-kpi',
  imports: [RouterLink, Icone],
  template: `
    <article class="cartao cartao-interativo entrar relative flex h-full flex-col overflow-hidden"
             [attr.aria-labelledby]="id + '-rotulo'" [attr.data-kpi]="rotulo()">
      <span aria-hidden="true" class="absolute inset-x-0 top-0 h-1" [class]="faixa()"></span>
      <div class="flex items-start justify-between gap-2">
        <h3 [id]="id + '-rotulo'" class="flex items-center gap-2 text-sm font-semibold text-suave">
          @if (icone()) { <span class="rounded-md bg-destaque p-1.5 text-verde-escuro"><pulso-icone [nome]="icone()!" class="size-4" /></span> }
          {{ rotulo() }}
        </h3>
        @if (formula()) {
          <button type="button" class="botao-icone -mr-2 -mt-1" [attr.aria-expanded]="aberta()" [attr.aria-controls]="id + '-formula'"
                  [attr.aria-label]="'Como é calculado: ' + rotulo()" (click)="aberta.set(!aberta())">
            <pulso-icone nome="info" class="size-4" />
          </button>
        }
      </div>
      <p class="mt-3 text-2xl font-extrabold tabular-nums tracking-tight sm:text-3xl" [class.text-erro]="negativo()" data-kpi-valor>{{ exibido() }}</p>
      @if (detalhe()) { <p class="mt-1 text-sm text-suave">{{ detalhe() }}</p> }
      @if (aberta()) {
        <p [id]="id + '-formula'" class="entrar mt-3 rounded-md border-l-4 border-verde bg-fundo p-2 text-xs text-texto">{{ formula() }}</p>
      }
      @if (link()) {
        <a [routerLink]="link()" [queryParams]="consulta()"
           class="mt-auto inline-flex items-center gap-1 self-start pt-3 text-sm font-semibold text-verde-escuro underline-offset-4 hover:underline">
          {{ textoLink() }} <pulso-icone nome="seta" class="size-4" />
        </a>
      }
    </article>
  `,
  host: { class: 'block' },
})
export class Kpi {
  protected readonly id = `kpi-${++contador}`;
  readonly rotulo = input.required<string>();
  readonly valor = input.required<number | null>();
  readonly formato = input<FormatoKpi>('brl');
  readonly detalhe = input<string | null>(null);
  readonly formula = input<string | null>(null);
  readonly icone = input<string | null>(null);
  readonly tom = input<'verde' | 'ambar' | 'erro' | 'neutro'>('verde');
  readonly link = input<string | null>(null);
  readonly consulta = input<Record<string, string> | null>(null);
  readonly textoLink = input('Ver detalhes');

  protected readonly aberta = signal(false);
  protected readonly exibido = signal('—');
  protected readonly negativo = computed(() => (this.valor() ?? 0) < 0);
  protected readonly faixa = computed(() => ({ verde: 'bg-verde', ambar: 'bg-ambar', erro: 'bg-erro', neutro: 'bg-borda' })[this.tom()]);

  private atual = 0;
  private quadro: number | null = null;

  constructor() {
    effect(() => {
      const alvo = this.valor();
      const formato = this.formato();
      untracked(() => this.animar(alvo, formato));
    });
    inject(DestroyRef).onDestroy(() => this.cancelar());
  }

  private cancelar(): void {
    if (this.quadro !== null) cancelAnimationFrame(this.quadro);
    this.quadro = null;
  }

  private animar(alvo: number | null, formato: FormatoKpi): void {
    this.cancelar();
    if (alvo === null || !movimentoPermitido()) {
      this.exibido.set(formatarKpi(alvo, formato));
      this.atual = alvo ?? 0;
      return;
    }
    const inicio = this.atual;
    const t0 = performance.now();
    const duracao = 700;
    const passo = (t: number) => {
      const k = Math.min(1, (t - t0) / duracao);
      const suave = 1 - Math.pow(1 - k, 3);
      this.exibido.set(formatarKpi(k === 1 ? alvo : inicio + (alvo - inicio) * suave, formato));
      if (k < 1) {
        this.quadro = requestAnimationFrame(passo);
      } else {
        this.atual = alvo;
        this.quadro = null;
      }
    };
    this.quadro = requestAnimationFrame(passo);
  }
}
