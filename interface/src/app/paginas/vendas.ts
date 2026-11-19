import { Component, DestroyRef, ElementRef, Injector, afterNextRender, computed, effect, inject, signal, untracked, viewChild } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { mensagemErro, obrigatorio } from '../formularios/validacao';
import type { DetalheVenda, ListaVendas, PedidoEstorno, RespostaEstorno } from '../nucleo/contratos';
import type { ControleEnvio } from '../nucleo/envio';
import { descreverPeriodo, diaLocal } from '../nucleo/periodo';
import { PulsoApi } from '../nucleo/pulso-api';
import { RegistroEnvios } from '../nucleo/registro-envios';
import { AvisoEnvio } from '../ui/aviso-envio';
import { Campo } from '../ui/campo';
import { Carga, Carregando, FalhaConsulta, Vazio } from '../ui/carga';
import { BrlPipe, DataHoraPipe, DeltaPipe, RotuloCategoriaPipe, TipoMovimentoPipe } from '../ui/formatos';

@Component({
  selector: 'pulso-vendas',
  imports: [RouterLink, Carregando, FalhaConsulta, Vazio, BrlPipe, DataHoraPipe, RotuloCategoriaPipe],
  template: `
    <div class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 tabindex="-1" class="text-2xl font-extrabold tracking-tight sm:text-3xl">Vendas</h1>
        <p class="mt-1 text-sm text-suave">Mais recentes primeiro. Valores gravados no momento de cada venda.</p>
      </div>
      <a routerLink="/vendas/nova" class="botao-principal self-start sm:self-auto">Registrar venda</a>
    </div>
    @if (filtro(); as f) {
      <p class="entrar mt-4 flex flex-wrap items-center gap-2 text-sm" data-filtro-periodo>
        <span class="rotulo-chip bg-destaque text-verde-escuro">Período: {{ f.descricao }}</span>
        <span class="text-suave">até 500 vendas, vindas do painel</span>
        <a routerLink="/vendas" class="font-semibold text-verde-escuro underline">Limpar filtro</a>
      </p>
    }
    <div class="mt-6 max-w-md" role="search">
      <label for="busca-vendas" class="rotulo">Buscar por número da venda ou requisição</label>
      <input id="busca-vendas" type="search" class="campo-entrada" autocomplete="off" placeholder="VEN-..."
             [value]="busca()" (input)="busca.set($any($event.target).value)" />
    </div>
    <section class="mt-6" aria-labelledby="titulo-lista-vendas">
      <h2 id="titulo-lista-vendas" class="sr-only">Lista de vendas</h2>
      @switch (carga.estado().fase) {
        @case ('carregando') { <pulso-carregando texto="Carregando vendas…" /> }
        @case ('falha') {
          @if (carga.estado(); as e) { @if (e.fase === 'falha') { <pulso-falha-consulta [erro]="e.erro" (tentarDeNovo)="carga.carregar()" /> } }
        }
        @case ('pronto') {
          @if (total() === 0) {
            <pulso-vazio titulo="Nenhuma venda registrada" texto="As vendas confirmadas aparecem aqui.">
              <a routerLink="/vendas/nova" class="botao-principal">Registrar venda</a>
            </pulso-vazio>
          } @else if (visiveis().length === 0) {
            <pulso-vazio titulo="Nenhuma venda corresponde à busca">
              <button type="button" class="botao-secundario" (click)="busca.set('')">Limpar busca</button>
            </pulso-vazio>
          } @else {
            <p class="mb-3 text-sm text-suave" role="status">{{ visiveis().length }} de {{ total() }} venda(s).</p>
            <ul class="grid gap-3">
              @for (v of visiveis(); track v.vendaId) {
                <li class="cartao cartao-interativo entrar flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div class="min-w-0">
                    <a [routerLink]="['/vendas', v.vendaId]" class="break-all font-mono text-sm font-semibold text-verde-escuro underline">{{ v.vendaId }}</a>
                    <p class="text-sm text-suave">{{ v.registradoEm | dataHora }} · {{ v.quantidadeItens }} item(ns) · {{ v.formaPagamento | rotuloCategoria }}</p>
                  </div>
                  <div class="flex items-center gap-3">
                    @if (v.estado === 'ESTORNADA') {
                      <span class="rounded-sm bg-fundo px-2 py-0.5 text-xs font-semibold text-suave ring-1 ring-borda">Estornada</span>
                    } @else {
                      <span class="rounded-sm bg-destaque px-2 py-0.5 text-xs font-semibold text-verde-escuro">Confirmada</span>
                    }
                    <span class="text-lg font-bold tabular-nums" [class.line-through]="v.estado === 'ESTORNADA'">{{ v.totalCentavos | brl }}</span>
                  </div>
                </li>
              }
            </ul>
          }
        }
      }
    </section>
  `,
})
export class VendasPagina {
  private readonly api = inject(PulsoApi);
  /** Filtro de período vindo do painel: instantes UTC [desde, ate), validados pelo núcleo. */
  protected readonly filtro = signal<{ desde: string; ate: string; descricao: string } | null>(null);
  protected readonly carga = new Carga<ListaVendas>(() => {
    const f = this.filtro();
    return this.api.listarVendas(f ? { desde: f.desde, ate: f.ate, limite: 500 } : {});
  });
  protected readonly busca = signal('');
  protected readonly total = computed(() => this.carga.valor?.vendas.length ?? 0);
  protected readonly visiveis = computed(() => {
    const termo = this.busca().trim().toUpperCase();
    return (this.carga.valor?.vendas ?? []).filter((v) => !termo || v.vendaId.toUpperCase().includes(termo) || v.requisicaoId.toUpperCase().includes(termo));
  });

  constructor() {
    const assinatura = inject(ActivatedRoute).queryParamMap.subscribe((q) => {
      const desde = q.get('desde');
      const ate = q.get('ate');
      this.filtro.set(desde && ate ? { desde, ate, descricao: descreverInstantes(desde, ate) } : null);
      void this.carga.carregar();
    });
    inject(DestroyRef).onDestroy(() => assinatura.unsubscribe());
  }
}

/** Rótulo do período [desde, ate) em dias de São Paulo; só apresentação. */
function descreverInstantes(desde: string, ate: string): string {
  const inicio = Date.parse(desde);
  const fim = Date.parse(ate);
  if (!Number.isFinite(inicio) || !Number.isFinite(fim)) return `${desde} a ${ate}`;
  return descreverPeriodo({ de: diaLocal(inicio), ate: diaLocal(fim - 1) });
}

@Component({
  selector: 'pulso-venda-detalhe',
  imports: [RouterLink, ReactiveFormsModule, AvisoEnvio, Campo, Carregando, FalhaConsulta, BrlPipe, DataHoraPipe, DeltaPipe, RotuloCategoriaPipe, TipoMovimentoPipe],
  template: `
    <nav aria-label="Trilha" class="mb-3 text-sm"><a routerLink="/vendas" class="text-verde-escuro underline">Vendas</a> / <span class="break-all">{{ vendaId() }}</span></nav>
    @switch (carga.estado().fase) {
      @case ('carregando') {
        <h1 tabindex="-1" class="mb-4 text-2xl font-extrabold">Venda</h1>
        <pulso-carregando texto="Carregando venda…" />
      }
      @case ('falha') {
        <h1 tabindex="-1" class="mb-4 text-2xl font-extrabold">Venda</h1>
        @if (carga.estado(); as e) { @if (e.fase === 'falha') {
          <pulso-falha-consulta [erro]="e.erro" [titulo]="e.erro.codigo === 'VENDA_INEXISTENTE' ? 'Venda não encontrada.' : 'Não foi possível carregar a venda.'" (tentarDeNovo)="carga.carregar()" />
        } }
      }
      @case ('pronto') {
        @if (carga.valor; as d) {
          <h1 tabindex="-1" class="break-all text-2xl font-extrabold tracking-tight sm:text-3xl">{{ d.venda.vendaId }}</h1>
          <p class="mt-1 text-sm text-suave">{{ d.venda.registradoEm | dataHora }} · {{ d.venda.formaPagamento | rotuloCategoria }} (informativo) · requisição <span class="break-all font-mono">{{ d.venda.requisicaoId }}</span></p>
          <div class="mt-2">
            @if (d.venda.estado === 'ESTORNADA') {
              <span class="rounded-sm bg-fundo px-2 py-0.5 text-xs font-semibold text-suave ring-1 ring-borda">Estornada</span>
            } @else {
              <span class="rounded-sm bg-destaque px-2 py-0.5 text-xs font-semibold text-verde-escuro">Confirmada</span>
            }
          </div>

          <dl class="mt-6 grid grid-cols-2 gap-3 sm:max-w-md">
            <div class="cartao"><dt class="text-sm font-semibold text-suave">Total</dt><dd class="mt-1 text-2xl font-extrabold tabular-nums">{{ d.venda.totalCentavos | brl }}</dd></div>
            <div class="cartao"><dt class="text-sm font-semibold text-suave">Custo estimado</dt><dd class="mt-1 text-2xl font-bold tabular-nums">{{ d.venda.custoEstCentavos | brl }}</dd></div>
          </dl>

          <section class="mt-6" aria-labelledby="titulo-itens-venda">
            <h2 id="titulo-itens-venda" class="text-lg font-bold">Itens</h2>
            <div class="mt-3 overflow-x-auto rounded-lg border border-borda bg-superficie">
              <table class="w-full min-w-[32rem] text-left text-sm">
                <caption class="sr-only">Itens com preço e custo capturados na venda</caption>
                <thead class="bg-fundo text-xs uppercase tracking-wide text-suave">
                  <tr><th scope="col" class="px-3 py-2">Produto</th><th scope="col" class="px-3 py-2 text-right">Qtd.</th><th scope="col" class="px-3 py-2 text-right">Preço</th><th scope="col" class="px-3 py-2 text-right">Subtotal</th><th scope="col" class="px-3 py-2 text-right">Custo unit.</th></tr>
                </thead>
                <tbody class="divide-y divide-borda">
                  @for (i of d.itens; track i.itemId) {
                    <tr><td class="px-3 py-2"><a [routerLink]="['/produtos', i.sku]" class="font-mono text-verde-escuro underline">{{ i.sku }}</a></td>
                      <td class="px-3 py-2 text-right tabular-nums">{{ i.quantidade }}</td><td class="px-3 py-2 text-right tabular-nums">{{ i.precoUnitCentavos | brl }}</td>
                      <td class="px-3 py-2 text-right font-semibold tabular-nums">{{ i.subtotalCentavos | brl }}</td><td class="px-3 py-2 text-right tabular-nums">{{ i.custoUnitEstCentavos | brl }}</td></tr>
                  }
                </tbody>
              </table>
            </div>
          </section>

          <section class="mt-6" aria-labelledby="titulo-movimentos-venda">
            <h2 id="titulo-movimentos-venda" class="text-lg font-bold">Movimentos de estoque</h2>
            <ul class="mt-2 space-y-1 text-sm">
              @for (m of d.movimentos; track m.movimentoId) {
                <li>{{ m.registradoEm | dataHora }} · {{ m.tipo | tipoMovimento }} · {{ m.sku }} · <span class="font-semibold tabular-nums" [class.text-erro]="m.deltaUnidades < 0">{{ m.deltaUnidades | delta }}</span></li>
              }
            </ul>
          </section>

          <section class="cartao mt-6 max-w-2xl" aria-labelledby="titulo-estorno">
            <h2 id="titulo-estorno" class="text-lg font-bold">Estorno</h2>
            @if (d.estorno; as e) {
              <p class="mt-2 text-sm">Estornada em {{ e.registradoEm | dataHora }}. Motivo: {{ e.motivo }}. As unidades voltaram ao estoque.</p>
            } @else {
              <p class="mt-1 text-sm text-suave">Estorno total, uma única vez: todas as unidades voltam ao estoque. A venda não é apagada.</p>
              <form #formEstorno [formGroup]="form" (ngSubmit)="estornar()" novalidate class="mt-3 space-y-3">
                <fieldset [disabled]="controle.enviando()">
                  <pulso-campo id="estorno-motivo" rotulo="Motivo do estorno" [erro]="erroMotivo()">
                    <input id="estorno-motivo" [formControl]="motivo" autocomplete="off" class="campo-entrada"
                           [attr.aria-invalid]="erroMotivo() ? true : null" [attr.aria-describedby]="erroMotivo() ? 'estorno-motivo-erro' : null" />
                  </pulso-campo>
                </fieldset>
                <button type="submit" class="botao-secundario" [disabled]="controle.enviando()">{{ controle.enviando() ? 'Estornando…' : 'Estornar venda' }}</button>
              </form>
            }
            <div class="mt-3"><pulso-aviso-envio [controle]="controle" /></div>
          </section>
        }
      }
    }
  `,
})
export class VendaDetalhePagina {
  private readonly api = inject(PulsoApi);
  private readonly registro = inject(RegistroEnvios);
  private readonly injector = inject(Injector);
  protected readonly vendaId = signal('');
  protected readonly carga = new Carga<DetalheVenda>(() => this.api.consultarVenda(this.vendaId()));
  protected readonly motivo = new FormControl('', { nonNullable: true, validators: [obrigatorio] });
  protected readonly form = new FormGroup({ motivo: this.motivo });
  protected readonly tentou = signal(false);
  protected controle!: ControleEnvio<Omit<PedidoEstorno, 'requisicaoId'>, RespostaEstorno>;
  private readonly formEstorno = viewChild<ElementRef<HTMLFormElement>>('formEstorno');

  constructor() {
    const api = this.api;
    const assinatura = inject(ActivatedRoute).paramMap.subscribe((params) => {
      this.vendaId.set(params.get('id') ?? '');
      this.controle = this.registro.obter<Omit<PedidoEstorno, 'requisicaoId'>, RespostaEstorno>(`estorno:${this.vendaId()}`, (p: PedidoEstorno) => api.estornarVenda(p));
      this.tentou.set(false);
      this.motivo.reset('');
      void this.carga.carregar();
    });
    inject(DestroyRef).onDestroy(() => assinatura.unsubscribe());
    effect(() => {
      this.vendaId();
      if (this.controle.estado().fase === 'sucesso') untracked(() => { void this.carga.carregar(true); });
    });
  }

  protected erroMotivo(): string | null {
    return mensagemErro(this.motivo, this.tentou());
  }

  protected async estornar(): Promise<void> {
    if (this.controle.enviando()) return;
    this.tentou.set(true);
    if (this.motivo.invalid) {
      afterNextRender(() => this.formEstorno()?.nativeElement.querySelector<HTMLElement>('input')?.focus(), { injector: this.injector });
      return;
    }
    await this.controle.enviar({ vendaId: this.vendaId(), motivo: this.motivo.value.trim() });
  }
}
