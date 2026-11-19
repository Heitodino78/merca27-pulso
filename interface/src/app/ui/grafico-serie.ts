import { Component, computed, input, signal } from '@angular/core';
import type { SerieDia } from '../nucleo/contratos';
import { formatarBRL, formatarInteiro } from '../nucleo/dinheiro';
import { diaDaSemana, formatarDia } from '../nucleo/periodo';
import { Icone } from './icone';

export type MetricaSerie = 'receita' | 'vendas' | 'perdas';

const LARGURA = 720;
const ALTURA = 240;
const MARGEM = { esquerda: 64, direita: 12, topo: 16, base: 34 };
const COMPACTO = new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 1 });

/** Topo do eixo "redondo" (1, 2, 2,5, 5 × 10^n) para as linhas de grade não ficarem quebradas. */
export function topoDoEixo(maximo: number): number {
  if (maximo <= 0) return 1;
  const potencia = Math.pow(10, Math.floor(Math.log10(maximo)));
  for (const fator of [1, 2, 2.5, 5, 10]) if (fator * potencia >= maximo) return fator * potencia;
  return 10 * potencia;
}

/**
 * Série diária devolvida pelo núcleo. Só desenha: nenhum valor é recalculado aqui.
 * Teclado: o gráfico é um único ponto de foco; setas, Home e End percorrem os dias.
 */
@Component({
  selector: 'pulso-grafico-serie',
  imports: [Icone],
  template: `
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div class="segmento" role="group" aria-label="Métrica do gráfico">
        @for (m of metricas; track m.id) {
          <button type="button" class="segmento-opcao" [attr.aria-pressed]="metrica() === m.id" (click)="trocar(m.id)">{{ m.rotulo }}</button>
        }
      </div>
      <button type="button" class="botao-secundario min-h-9 px-3 text-sm" [attr.aria-pressed]="comoTabela()" (click)="comoTabela.set(!comoTabela())">
        <pulso-icone [nome]="comoTabela() ? 'grafico' : 'tabela'" class="size-4" />
        {{ comoTabela() ? 'Ver gráfico' : 'Ver como tabela' }}
      </button>
    </div>

    @if (comoTabela()) {
      <div class="entrar mt-4 max-h-80 overflow-auto rounded-lg border border-borda">
        <table class="w-full text-left text-sm">
          <caption class="sr-only">Série diária do período</caption>
          <thead class="sticky top-0 bg-fundo text-xs uppercase tracking-wide text-suave">
            <tr><th scope="col" class="px-3 py-2">Dia</th><th scope="col" class="px-3 py-2 text-right">Receita bruta</th>
              <th scope="col" class="px-3 py-2 text-right">Devoluções</th><th scope="col" class="px-3 py-2 text-right">Vendas</th>
              <th scope="col" class="px-3 py-2 text-right">Perdas (un.)</th></tr>
          </thead>
          <tbody class="divide-y divide-borda">
            @for (d of serie(); track d.dia) {
              <tr><th scope="row" class="px-3 py-1.5 font-medium">{{ rotuloDia(d.dia) }}</th>
                <td class="px-3 py-1.5 text-right tabular-nums">{{ brl(d.receitaBrutaCentavos) }}</td>
                <td class="px-3 py-1.5 text-right tabular-nums">{{ brl(d.devolucoesCentavos) }}</td>
                <td class="px-3 py-1.5 text-right tabular-nums">{{ d.numeroVendas }}</td>
                <td class="px-3 py-1.5 text-right tabular-nums">{{ d.perdasUnidades }}</td></tr>
            }
          </tbody>
        </table>
      </div>
    } @else {
      <div class="relative mt-4" (mouseleave)="ativo.set(null)">
        <svg [attr.viewBox]="'0 0 ' + largura + ' ' + altura" class="h-auto w-full touch-none select-none overflow-visible rounded-md outline-offset-4"
             tabindex="0" role="img" [attr.aria-label]="descricao()" aria-describedby="grafico-ajuda"
             (keydown)="tecla($event)" (focus)="aoFocar()" (blur)="ativo.set(null)">
          @for (linha of grade(); track linha.y) {
            <line [attr.x1]="margem.esquerda" [attr.x2]="largura - margem.direita" [attr.y1]="linha.y" [attr.y2]="linha.y" stroke="#d3d8d2" stroke-dasharray="3 4" />
            <text [attr.x]="margem.esquerda - 8" [attr.y]="linha.y + 4" text-anchor="end" font-size="11" fill="#4a5856">{{ linha.rotulo }}</text>
          }
          @for (b of barras(); track b.dia; let i = $index) {
            <g [attr.data-dia]="b.dia" [attr.opacity]="ativo() === null || ativo() === i ? 1 : 0.45">
              <rect [attr.x]="b.x" [attr.y]="b.y1" [attr.width]="b.largura" [attr.height]="b.altura1" rx="3" [attr.fill]="corPrincipal()"
                    class="motion-safe:transition-[y,height] motion-safe:duration-500" />
              @if (b.altura2 > 0) {
                <rect [attr.x]="b.x + b.largura + 1" [attr.y]="b.y2" [attr.width]="b.largura" [attr.height]="b.altura2" rx="3" fill="#dca44c" />
              }
              <rect [attr.x]="b.slotX" [attr.y]="margem.topo" [attr.width]="b.slot" [attr.height]="areaAltura" fill="transparent"
                    (mouseenter)="ativo.set(i)" (click)="ativo.set(i)" />
            </g>
          }
          @for (r of rotulosX(); track r.dia) {
            <text [attr.x]="r.x" [attr.y]="altura - 10" text-anchor="middle" font-size="11" fill="#4a5856">{{ r.texto }}</text>
          }
          <line [attr.x1]="margem.esquerda" [attr.x2]="largura - margem.direita" [attr.y1]="margem.topo + areaAltura" [attr.y2]="margem.topo + areaAltura" stroke="#4a5856" />
        </svg>

        @if (vazio()) {
          <p class="pointer-events-none absolute inset-0 flex items-center justify-center text-sm font-semibold text-suave">Sem movimento no período.</p>
        }

        @if (detalheAtivo(); as d) {
          <div class="pointer-events-none absolute top-0 z-10 w-max max-w-56 -translate-x-1/2 rounded-lg border border-borda bg-superficie px-3 py-2 text-xs shadow-elevada"
               [style.left.%]="d.posicao" data-dica-grafico>
            <p class="font-bold text-texto">{{ d.titulo }}</p>
            @for (linha of d.linhas; track linha) { <p class="text-texto">{{ linha }}</p> }
          </div>
        }
        <p role="status" class="sr-only">{{ detalheAtivo() ? detalheAtivo()!.titulo + ': ' + detalheAtivo()!.linhas.join('; ') : '' }}</p>
      </div>
      <p id="grafico-ajuda" class="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-suave">
        <span class="inline-flex items-center gap-1.5"><span aria-hidden="true" class="inline-block size-3 rounded-sm" [style.background]="corPrincipal()"></span>{{ legenda() }}</span>
        @if (metrica() === 'receita') {
          <span class="inline-flex items-center gap-1.5"><span aria-hidden="true" class="inline-block size-3 rounded-sm bg-ambar"></span>Devoluções (data do estorno)</span>
        }
        <span>Passe o mouse ou use as setas do teclado para ver cada dia.</span>
      </p>
    }
  `,
  host: { class: 'block' },
})
export class GraficoSerie {
  readonly serie = input.required<SerieDia[]>();

  protected readonly largura = LARGURA;
  protected readonly altura = ALTURA;
  protected readonly margem = MARGEM;
  protected readonly areaAltura = ALTURA - MARGEM.topo - MARGEM.base;
  protected readonly metricas: { id: MetricaSerie; rotulo: string }[] = [
    { id: 'receita', rotulo: 'Receita' },
    { id: 'vendas', rotulo: 'Nº de vendas' },
    { id: 'perdas', rotulo: 'Perdas' },
  ];

  readonly metrica = signal<MetricaSerie>('receita');
  readonly ativo = signal<number | null>(null);
  protected readonly comoTabela = signal(false);

  protected readonly corPrincipal = computed(() => (this.metrica() === 'perdas' ? '#a12622' : '#17685b'));
  protected readonly legenda = computed(() => ({ receita: 'Receita bruta (data da venda)', vendas: 'Vendas registradas', perdas: 'Unidades perdidas' })[this.metrica()]);

  private readonly valores = computed(() => this.serie().map((d) => {
    switch (this.metrica()) {
      case 'receita': return [d.receitaBrutaCentavos, d.devolucoesCentavos] as const;
      case 'vendas': return [d.numeroVendas, 0] as const;
      default: return [d.perdasUnidades, 0] as const;
    }
  }));
  private readonly topo = computed(() => topoDoEixo(Math.max(0, ...this.valores().flat())));
  protected readonly vazio = computed(() => this.valores().every(([a, b]) => a === 0 && b === 0));

  protected readonly grade = computed(() => {
    const topo = this.topo();
    return [0, 0.25, 0.5, 0.75, 1].map((f) => ({
      y: MARGEM.topo + this.areaAltura * (1 - f),
      rotulo: this.rotuloEixo(topo * f),
    }));
  });

  protected readonly barras = computed(() => {
    const serie = this.serie();
    const n = Math.max(1, serie.length);
    const slot = (LARGURA - MARGEM.esquerda - MARGEM.direita) / n;
    const duas = this.metrica() === 'receita';
    const largura = Math.max(1, (slot * 0.72) / (duas ? 2 : 1) - (duas ? 0.5 : 0));
    const topo = this.topo();
    const base = MARGEM.topo + this.areaAltura;
    const altura = (v: number) => (v <= 0 ? 0 : Math.max(2, (v / topo) * this.areaAltura));
    return this.valores().map(([a, b], i) => {
      const slotX = MARGEM.esquerda + i * slot;
      const x = slotX + (slot - largura * (duas ? 2 : 1) - (duas ? 1 : 0)) / 2;
      return { dia: serie[i]?.dia ?? String(i), slot, slotX, x, largura,
        altura1: altura(a), y1: base - altura(a), altura2: duas ? altura(b) : 0, y2: base - altura(b), centro: slotX + slot / 2 };
    });
  });

  protected readonly rotulosX = computed(() => {
    const barras = this.barras();
    const passo = Math.ceil(barras.length / 8);
    const curto = barras.length <= 7;
    return barras.filter((_, i) => i % passo === 0).map((b) => ({ dia: b.dia, x: b.centro, texto: curto ? `${diaDaSemana(b.dia)} ${formatarDia(b.dia, true)}` : formatarDia(b.dia, true) }));
  });

  protected readonly descricao = computed(() => {
    const s = this.serie();
    const total = this.valores().reduce((soma, [a]) => soma + a, 0);
    const valor = this.metrica() === 'receita' ? formatarBRL(total) : formatarInteiro(total);
    return `Gráfico de barras: ${this.legenda()} em ${s.length} dia(s), total ${valor}.`;
  });

  protected readonly detalheAtivo = computed(() => {
    const i = this.ativo();
    if (i === null) return null;
    const d = this.serie()[i];
    const b = this.barras()[i];
    if (!d || !b) return null;
    return {
      posicao: Math.min(88, Math.max(12, (b.centro / LARGURA) * 100)),
      titulo: `${diaDaSemana(d.dia)}, ${formatarDia(d.dia)}`,
      linhas: [
        `Receita bruta ${formatarBRL(d.receitaBrutaCentavos)}`,
        `Devoluções ${formatarBRL(d.devolucoesCentavos)}`,
        `${d.numeroVendas} venda(s), ${d.unidadesVendidas} un.`,
        `Perdas ${d.perdasUnidades} un.`,
      ],
    };
  });

  protected trocar(m: MetricaSerie): void {
    this.metrica.set(m);
  }

  protected aoFocar(): void {
    if (this.ativo() === null) this.ativo.set(Math.max(0, this.serie().length - 1));
  }

  protected tecla(evento: KeyboardEvent): void {
    const n = this.serie().length;
    if (!n) return;
    const atual = this.ativo() ?? n - 1;
    const proximo = ({ ArrowRight: atual + 1, ArrowLeft: atual - 1, Home: 0, End: n - 1 } as Record<string, number>)[evento.key];
    if (proximo === undefined) return;
    evento.preventDefault();
    this.ativo.set(Math.min(n - 1, Math.max(0, proximo)));
  }

  protected rotuloDia(dia: string): string {
    return `${diaDaSemana(dia)} ${formatarDia(dia)}`;
  }

  protected brl(c: number): string {
    return formatarBRL(c);
  }

  private rotuloEixo(valor: number): string {
    return this.metrica() === 'receita' ? `R$ ${COMPACTO.format(valor / 100)}` : COMPACTO.format(valor);
  }
}
