import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { Indicadores } from '../nucleo/contratos';
import { formatarBRL, formatarInteiro } from '../nucleo/dinheiro';
import {
  LIMITE_DIAS, PRESETS, RELOGIO, descreverPeriodo, diasNoPeriodo, paraInstantes, periodoDoPreset, problemaPeriodo,
  type PeriodoDias, type Preset,
} from '../nucleo/periodo';
import { PulsoApi } from '../nucleo/pulso-api';
import { Carga, FalhaConsulta } from '../ui/carga';
import { GraficoSerie } from '../ui/grafico-serie';
import { Icone } from '../ui/icone';
import { Kpi, formatarKpi } from '../ui/kpi';

const CATEGORIAS_PERDA = [
  { id: 'AVARIA', rotulo: 'Avaria', cor: 'bg-erro' },
  { id: 'VENCIMENTO', rotulo: 'Vencimento', cor: 'bg-ambar' },
  { id: 'QUEBRA', rotulo: 'Quebra', cor: 'bg-suave' },
] as const;

/**
 * Visão geral (Fase 3). Todos os números vêm de consultarIndicadores; a página só escolhe o
 * período, converte dias de São Paulo em instantes UTC e apresenta. Nada é recalculado aqui.
 */
@Component({
  selector: 'pulso-visao-geral',
  imports: [RouterLink, FalhaConsulta, GraficoSerie, Icone, Kpi],
  template: `
    <header class="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <p class="text-sm font-semibold uppercase tracking-wider text-verde">Painel gerencial</p>
        <h1 tabindex="-1" class="text-3xl font-extrabold tracking-tight sm:text-4xl">Visão geral</h1>
        <p class="mt-1 flex items-center gap-2 text-sm text-suave">
          <pulso-icone nome="calendario" class="size-4" />
          <span data-periodo>{{ descricaoPeriodo() }}</span> · {{ dias() }} dia(s) · America/Sao_Paulo
        </p>
      </div>
      <div class="flex flex-col items-start gap-2 lg:items-end">
        <div class="segmento flex-wrap" role="group" aria-label="Período">
          @for (p of presets; track p.id) {
            <button type="button" class="segmento-opcao" [attr.aria-pressed]="preset() === p.id" (click)="escolher(p.id)">{{ p.rotulo }}</button>
          }
        </div>
        @if (preset() === 'personalizado') {
          <form class="entrar flex flex-wrap items-end gap-2" (submit)="$event.preventDefault(); aplicarPersonalizado()" novalidate>
            <div>
              <label for="periodo-de" class="rotulo text-xs">De</label>
              <input id="periodo-de" type="date" class="campo-entrada py-1.5" [value]="rascunho().de"
                     (input)="rascunho.set({ de: $any($event.target).value, ate: rascunho().ate })"
                     [attr.aria-invalid]="erroPeriodo() ? true : null" [attr.aria-describedby]="erroPeriodo() ? 'periodo-erro' : null" />
            </div>
            <div>
              <label for="periodo-ate" class="rotulo text-xs">Até</label>
              <input id="periodo-ate" type="date" class="campo-entrada py-1.5" [value]="rascunho().ate"
                     (input)="rascunho.set({ de: rascunho().de, ate: $any($event.target).value })"
                     [attr.aria-invalid]="erroPeriodo() ? true : null" [attr.aria-describedby]="erroPeriodo() ? 'periodo-erro' : null" />
            </div>
            <button type="submit" class="botao-principal min-h-10">Aplicar</button>
            @if (erroPeriodo()) { <p id="periodo-erro" role="alert" class="erro-campo w-full">{{ erroPeriodo() }}</p> }
          </form>
        }
      </div>
    </header>

    <div class="relative mt-4 h-1 overflow-hidden rounded-full" [class.bg-destaque]="recarregando()" aria-hidden="true">
      @if (recarregando()) { <span class="absolute inset-y-0 w-1/3 rounded-full bg-verde motion-safe:animate-progresso"></span> }
    </div>

    @switch (carga.estado().fase) {
      @case ('carregando') {
        <div role="status" class="mt-4" aria-label="Carregando indicadores…">
          <span class="sr-only">Carregando indicadores…</span>
          <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            @for (i of [1, 2, 3, 4]; track i) { <div class="cartao"><div class="esqueleto h-4 w-24"></div><div class="esqueleto mt-4 h-8 w-36"></div><div class="esqueleto mt-3 h-3 w-28"></div></div> }
          </div>
          <div class="cartao mt-4"><div class="esqueleto h-56 w-full"></div></div>
        </div>
      }
      @case ('falha') {
        @if (carga.estado(); as e) { @if (e.fase === 'falha') {
          <div class="mt-4"><pulso-falha-consulta [erro]="e.erro" titulo="Não foi possível carregar os indicadores." (tentarDeNovo)="carga.carregar()" /></div>
        } }
      }
      @case ('pronto') {
        @if (carga.valor; as r) {
          @for (aviso of r.avisos; track aviso) {
            <p role="status" class="mt-4 rounded-lg border-l-4 border-ambar bg-ambar-claro p-3 text-sm text-texto">{{ aviso }}</p>
          }

          <section aria-labelledby="titulo-resultado" class="mt-4">
            <h2 id="titulo-resultado" class="sr-only">Resultado do período</h2>
            <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <pulso-kpi rotulo="Receita após devoluções" icone="grafico" [valor]="r.resultado.receitaAposDevolucoesCentavos"
                         [detalhe]="'Bruta ' + brl(r.resultado.receitaBrutaCentavos) + ' − devoluções ' + brl(r.resultado.devolucoesCentavos)"
                         [formula]="r.formulas.receitaAposDevolucoes" [tom]="r.resultado.receitaAposDevolucoesCentavos < 0 ? 'erro' : 'verde'" />
              <pulso-kpi rotulo="Vendas" icone="vendas" formato="inteiro" [valor]="r.vendas.numero"
                         [detalhe]="unidades(r.vendas.unidades) + ' vendida(s)' + (r.vendas.estornadasDepois ? ' · ' + r.vendas.estornadasDepois + ' estornada(s) depois' : '')"
                         [formula]="r.formulas.receitaBruta" link="/vendas" [consulta]="filtroVendas()" textoLink="Ver vendas do período" />
              <pulso-kpi rotulo="Margem bruta estimada" icone="painel" [valor]="r.resultado.margemBrutaCentavos"
                         [detalhe]="'Margem ' + pct(r.resultado.margemPercentual) + ' · CMV ' + brl(r.resultado.cmvEstimadoCentavos)"
                         [formula]="r.formulas.margemBruta" [tom]="r.resultado.margemBrutaCentavos < 0 ? 'erro' : 'verde'" />
              <pulso-kpi rotulo="Perdas" icone="reposicao" [valor]="r.perdas.valorCentavos" tom="ambar"
                         [detalhe]="unidades(r.perdas.unidades) + ' baixada(s) · separado de vendas'" [formula]="r.formulas.perdas" />
            </div>
            <div class="mt-4 grid grid-cols-2 gap-4 xl:grid-cols-4">
              <pulso-kpi rotulo="Ticket médio" [valor]="r.resultado.ticketMedioCentavos" tom="neutro" [formula]="r.formulas.ticketMedio" />
              <pulso-kpi rotulo="Margem %" formato="pct" [valor]="r.resultado.margemPercentual" tom="neutro" [formula]="r.formulas.margemPercentual" />
              <pulso-kpi rotulo="Devoluções" [valor]="r.resultado.devolucoesCentavos" tom="neutro"
                         [detalhe]="r.devolucoes.numero + ' estorno(s)' + (r.devolucoes.deVendasAnteriores ? ', ' + r.devolucoes.deVendasAnteriores + ' de venda(s) anterior(es)' : '')"
                         [formula]="r.formulas.devolucoes" />
              <pulso-kpi rotulo="Estoque agora (estimado)" [valor]="r.estoqueAtual.valorCentavos" tom="neutro"
                         [detalhe]="unidades(r.estoqueAtual.unidades) + ' · retrato atual'" [formula]="r.formulas.valorEstoque" link="/produtos" textoLink="Ver produtos" />
            </div>
          </section>

          <section class="cartao entrar mt-6" aria-labelledby="titulo-serie">
            <div class="mb-3 flex items-baseline justify-between gap-2">
              <h2 id="titulo-serie" class="text-lg font-bold">Movimento por dia</h2>
              <p class="text-xs text-suave">Vendas pela data da venda; devoluções pela data do estorno.</p>
            </div>
            <pulso-grafico-serie [serie]="r.serie" />
          </section>

          <div class="mt-6 grid gap-6 lg:grid-cols-5">
            <section class="cartao entrar lg:col-span-3" aria-labelledby="titulo-ranking">
              <div class="flex items-baseline justify-between gap-2">
                <h2 id="titulo-ranking" class="text-lg font-bold">Produtos com mais receita</h2>
                <p class="text-xs text-suave">{{ r.totalSkusVendidos }} SKU(s) vendido(s)</p>
              </div>
              @if (r.produtosMaisVendidos.length === 0) {
                <p class="mt-6 rounded-lg border border-dashed border-borda p-6 text-center text-sm text-suave">Nenhuma venda no período.</p>
              } @else {
                <ol class="mt-4 space-y-3">
                  @for (p of r.produtosMaisVendidos; track p.sku; let i = $index) {
                    <li>
                      <a [routerLink]="['/produtos', p.sku]" class="group block rounded-md p-1 -m-1 hover:bg-fundo">
                        <div class="flex items-baseline justify-between gap-3 text-sm">
                          <span class="min-w-0 truncate"><span class="mr-2 font-mono text-xs text-suave">{{ i + 1 }}.</span><span class="font-semibold group-hover:underline">{{ p.nome }}</span></span>
                          <span class="shrink-0 font-bold tabular-nums">{{ brl(p.receitaBrutaCentavos) }}</span>
                        </div>
                        <div class="mt-1 h-2 overflow-hidden rounded-full bg-fundo" aria-hidden="true">
                          <div class="h-full origin-left rounded-full bg-verde motion-safe:animate-crescer" [style.width.%]="largura(p.receitaBrutaCentavos, r)"
                               [style.animation-delay.ms]="i * 60"></div>
                        </div>
                        <p class="mt-0.5 text-xs text-suave">{{ p.sku }} · {{ unidades(p.unidadesVendidas) }}@if (p.unidadesDevolvidas) { · {{ p.unidadesDevolvidas }} devolvida(s)}</p>
                      </a>
                    </li>
                  }
                </ol>
              }
            </section>

            <div class="space-y-6 lg:col-span-2">
              <section class="cartao entrar" aria-labelledby="titulo-alertas">
                <div class="flex items-center justify-between gap-2">
                  <h2 id="titulo-alertas" class="text-lg font-bold">Reposição sugerida</h2>
                  <span class="rotulo-chip" [class]="r.reposicao.quantidade ? 'bg-ambar text-texto' : 'bg-destaque text-verde-escuro'">{{ r.reposicao.quantidade }} agora</span>
                </div>
                @if (r.reposicao.quantidade === 0) {
                  <p class="mt-3 text-sm text-suave">Todos os produtos ativos estão acima do mínimo.</p>
                } @else {
                  <ul class="mt-3 divide-y divide-borda">
                    @for (item of r.reposicao.itens; track item.sku) {
                      <li class="flex items-center justify-between gap-3 py-2 text-sm">
                        <a [routerLink]="['/produtos', item.sku]" class="min-w-0 truncate font-semibold hover:underline">{{ item.nome }}</a>
                        <span class="shrink-0 tabular-nums text-suave">saldo {{ item.saldoAtual }} · <strong class="text-texto">+{{ item.sugestaoUnidades }}</strong></span>
                      </li>
                    }
                  </ul>
                  <a routerLink="/reposicao" class="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-verde-escuro hover:underline">
                    Ver todos <pulso-icone nome="seta" class="size-4" />
                  </a>
                }
              </section>

              <section class="cartao entrar" aria-labelledby="titulo-perdas">
                <h2 id="titulo-perdas" class="text-lg font-bold">Perdas por motivo</h2>
                @if (r.perdas.unidades === 0) {
                  <p class="mt-3 text-sm text-suave">Nenhuma perda registrada no período.</p>
                } @else {
                  <div class="mt-4 flex h-3 overflow-hidden rounded-full bg-fundo" aria-hidden="true">
                    @for (c of categorias; track c.id) {
                      <span class="h-full origin-left motion-safe:animate-crescer" [class]="c.cor" [style.width.%]="fatiaPerda(c.id, r)"></span>
                    }
                  </div>
                  <dl class="mt-3 space-y-1.5 text-sm">
                    @for (c of categorias; track c.id) {
                      <div class="flex items-center justify-between gap-2">
                        <dt class="flex items-center gap-2"><span aria-hidden="true" class="inline-block size-3 rounded-sm" [class]="c.cor"></span>{{ c.rotulo }}</dt>
                        <dd class="tabular-nums">{{ r.perdas.porCategoria[c.id]?.unidades ?? 0 }} un. · {{ brl(r.perdas.porCategoria[c.id]?.valorCentavos ?? 0) }}</dd>
                      </div>
                    }
                  </dl>
                }
                <p class="mt-3 border-t border-borda pt-3 text-xs text-suave">
                  Ajustes de contagem: +{{ r.ajustes.unidadesAcrescidas }} / −{{ r.ajustes.unidadesRetiradas }} un. ·
                  Entradas: {{ unidades(r.entradas.unidades) }} ({{ brl(r.entradas.valorCentavos) }}).
                </p>
              </section>
            </div>
          </div>

          <details class="cartao entrar group mt-6">
            <summary class="flex cursor-pointer list-none items-center justify-between gap-2 font-bold">
              Como estes números são calculados
              <span aria-hidden="true" class="text-verde motion-safe:transition-transform group-open:rotate-90">›</span>
            </summary>
            <p class="mt-3 text-sm">{{ r.periodo.regra }}</p>
            <ul class="mt-3 grid gap-2 text-sm text-texto sm:grid-cols-2">
              @for (f of formulas(r); track f.nome) { <li><strong>{{ f.nome }}:</strong> {{ f.texto }}</li> }
            </ul>
            <p class="mt-3 text-xs text-suave">
              Rastreável até a origem: {{ r.origem.vendaIds.length }} venda(s), {{ r.origem.estornoIds.length }} estorno(s) e
              {{ r.origem.movimentosPerda.length }} movimento(s) de perda confirmados. Valores gerenciais e fictícios; não são lucro, caixa ou apuração contábil.
            </p>
          </details>
        }
      }
    }
  `,
})
export class VisaoGeralPagina {
  private readonly api = inject(PulsoApi);
  private readonly agora = inject(RELOGIO);

  protected readonly presets = PRESETS;
  protected readonly categorias = CATEGORIAS_PERDA;
  protected readonly limiteDias = LIMITE_DIAS;

  protected readonly preset = signal<Preset>('7d');
  protected readonly periodo = signal<PeriodoDias>(periodoDoPreset('7d', this.agora()));
  protected readonly rascunho = signal<PeriodoDias>(this.periodo());
  protected readonly erroPeriodo = signal<string | null>(null);
  protected readonly recarregando = signal(false);

  protected readonly descricaoPeriodo = computed(() => descreverPeriodo(this.periodo()));
  protected readonly dias = computed(() => diasNoPeriodo(this.periodo()));
  protected readonly filtroVendas = computed(() => paraInstantes(this.periodo()));

  protected readonly carga = new Carga<Indicadores>(() => {
    const { desde, ate } = paraInstantes(this.periodo());
    return this.api.consultarIndicadores(desde, ate);
  });

  constructor() {
    void this.carga.carregar();
  }

  protected escolher(preset: Preset): void {
    this.preset.set(preset);
    this.erroPeriodo.set(null);
    if (preset === 'personalizado') {
      this.rascunho.set(this.periodo());
      return;
    }
    void this.mudarPeriodo(periodoDoPreset(preset, this.agora()));
  }

  protected aplicarPersonalizado(): void {
    const p = this.rascunho();
    const problema = problemaPeriodo(p);
    this.erroPeriodo.set(problema);
    if (!problema) void this.mudarPeriodo(p);
  }

  /** Mantém os números anteriores na tela enquanto o novo período carrega. */
  private async mudarPeriodo(p: PeriodoDias): Promise<void> {
    this.periodo.set(p);
    this.recarregando.set(true);
    await this.carga.carregar(true);
    this.recarregando.set(false);
  }

  protected brl(c: number): string {
    return formatarBRL(c);
  }

  protected pct(v: number | null): string {
    return formatarKpi(v, 'pct');
  }

  protected unidades(n: number): string {
    return `${formatarInteiro(n)} un.`;
  }

  protected largura(valor: number, r: Indicadores): number {
    const maximo = r.produtosMaisVendidos[0]?.receitaBrutaCentavos ?? 0;
    return maximo > 0 ? Math.max(2, (valor / maximo) * 100) : 0;
  }

  protected fatiaPerda(categoria: string, r: Indicadores): number {
    return r.perdas.unidades > 0 ? ((r.perdas.porCategoria[categoria]?.unidades ?? 0) / r.perdas.unidades) * 100 : 0;
  }

  protected formulas(r: Indicadores): { nome: string; texto: string }[] {
    const f = r.formulas;
    return [
      { nome: 'Receita bruta', texto: f.receitaBruta }, { nome: 'Devoluções', texto: f.devolucoes },
      { nome: 'Receita após devoluções', texto: f.receitaAposDevolucoes }, { nome: 'CMV estimado', texto: f.cmvEstimado },
      { nome: 'Margem bruta', texto: f.margemBruta }, { nome: 'Margem %', texto: f.margemPercentual },
      { nome: 'Ticket médio', texto: f.ticketMedio }, { nome: 'Perdas', texto: f.perdas }, { nome: 'Estoque agora', texto: f.valorEstoque },
    ];
  }
}
