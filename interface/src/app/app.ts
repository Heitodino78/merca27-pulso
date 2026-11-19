import { NgTemplateOutlet } from '@angular/common';
import { Component, DestroyRef, Injector, afterNextRender, inject, signal, viewChild } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { PulsoApi } from './nucleo/pulso-api';
import { Icone } from './ui/icone';
import { PaletaComandos } from './ui/paleta-comandos';

interface ItemMenu {
  rota: string;
  rotulo: string;
  icone: string;
  exato: boolean;
}

@Component({
  selector: 'pulso-raiz',
  imports: [NgTemplateOutlet, RouterOutlet, RouterLink, RouterLinkActive, Icone, PaletaComandos],
  host: { '(document:keydown.escape)': 'menuAberto.set(false)' },
  template: `
    <a href="#conteudo" (click)="pularParaConteudo($event)"
       class="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-md focus:bg-superficie focus:px-4 focus:py-2 focus:font-semibold focus:text-verde">
      Pular para o conteúdo
    </a>

    <ng-template #marca>
      <a routerLink="/visao-geral" class="group flex items-center gap-2.5 rounded-md">
        <span class="grid size-9 place-items-center rounded-lg bg-ambar text-texto shadow-sm motion-safe:transition-transform motion-safe:group-hover:rotate-6">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" class="size-5" aria-hidden="true">
            <path d="M2 12h4l2.5-6 4 12 2.5-6h7" />
          </svg>
        </span>
        <span class="leading-tight">
          <span class="block text-lg font-extrabold tracking-tight">PULSO</span>
          <span class="block text-xs font-medium opacity-90">MERCA 27 · gestão operacional</span>
        </span>
      </a>
    </ng-template>

    <ng-template #navegacao>
      <nav aria-label="Principal">
        <ul class="space-y-1">
          @for (item of menu; track item.rota) {
            <li>
              <a [routerLink]="item.rota" routerLinkActive="!bg-white/15 !text-white shadow-inner" [routerLinkActiveOptions]="{ exact: item.exato }"
                 ariaCurrentWhenActive="page"
                 class="flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-semibold text-destaque hover:bg-white/10 hover:text-white motion-safe:transition-colors">
                <pulso-icone [nome]="item.icone" class="size-5" />
                {{ item.rotulo }}
              </a>
            </li>
          }
        </ul>
      </nav>
    </ng-template>

    <!-- Menu lateral (telas largas) -->
    <aside class="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col gap-6 bg-verde-escuro px-4 py-5 text-white lg:flex">
      <ng-container *ngTemplateOutlet="marca" />
      <button type="button" (click)="abrirBusca()"
              class="flex min-h-10 items-center gap-2 rounded-lg bg-white/10 px-3 text-left text-sm text-destaque hover:bg-white/15 motion-safe:transition-colors">
        <pulso-icone nome="busca" class="size-4" />
        <span class="flex-1">Buscar…</span>
        <kbd class="rounded border border-white/25 px-1.5 font-mono text-xs">Ctrl K</kbd>
      </button>
      <ng-container *ngTemplateOutlet="navegacao" />
      <p class="mt-auto rounded-lg bg-white/10 p-3 text-xs leading-relaxed text-destaque">
        Demonstração educacional. Todos os dados são sintéticos.
      </p>
    </aside>

    <!-- Barra superior (telas estreitas) -->
    <header class="sticky top-0 z-20 flex items-center justify-between gap-2 border-b border-borda bg-superficie/90 px-4 py-2 text-texto backdrop-blur lg:hidden">
      <button type="button" class="botao-icone" aria-label="Abrir menu" [attr.aria-expanded]="menuAberto()" aria-controls="menu-gaveta" (click)="menuAberto.set(true)">
        <pulso-icone nome="menu" class="size-6" />
      </button>
      <span class="text-verde-escuro"><ng-container *ngTemplateOutlet="marca" /></span>
      <button type="button" class="botao-icone" aria-label="Buscar página ou produto" (click)="abrirBusca()">
        <pulso-icone nome="busca" class="size-5" />
      </button>
    </header>

    @if (menuAberto()) {
      <div class="fixed inset-0 z-40 bg-texto/40 backdrop-blur-sm lg:hidden" (click)="menuAberto.set(false)" aria-hidden="true"></div>
      <aside id="menu-gaveta" class="fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col gap-6 bg-verde-escuro px-4 py-5 text-white shadow-elevada motion-safe:animate-deslizar lg:hidden"
             role="dialog" aria-modal="true" aria-label="Menu">
        <div class="flex items-start justify-between">
          <ng-container *ngTemplateOutlet="marca" />
          <button type="button" class="inline-flex size-9 items-center justify-center rounded-md text-destaque hover:bg-white/10" aria-label="Fechar menu" (click)="menuAberto.set(false)">
            <pulso-icone nome="fechar" class="size-5" />
          </button>
        </div>
        <ng-container *ngTemplateOutlet="navegacao" />
      </aside>
    }

    <div class="lg:pl-64">
      <p class="bg-destaque px-4 py-1.5 text-center text-xs font-medium text-verde-escuro">
        Demonstração educacional: a MERCA 27 é fictícia e todos os dados são sintéticos.
      </p>

      @if (api.operacoesPendentes() > 0 || reconciliacao() !== 'ociosa') {
        <section aria-labelledby="titulo-pendencias" class="border-b-4 border-ambar bg-ambar-claro">
          <div class="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div role="status">
              <h2 id="titulo-pendencias" class="font-bold text-texto">
                @switch (reconciliacao()) {
                  @case ('concluida') { Pendências reconciliadas }
                  @case ('falhou') { A reconciliação não foi confirmada }
                  @default { Há {{ api.operacoesPendentes() }} operação(ões) aguardando reconciliação }
                }
              </h2>
              <p class="text-sm text-texto">
                @switch (reconciliacao()) {
                  @case ('concluida') { As operações interrompidas foram concluídas sem duplicar registros. }
                  @case ('falhou') { {{ mensagemReconciliacao() }} Nada foi duplicado; tente novamente. }
                  @default { Uma gravação foi interrompida. O próximo lançamento tenta concluí-la antes; você também pode concluir agora. }
                }
              </p>
            </div>
            @if (reconciliacao() === 'concluida') {
              <button type="button" class="botao-secundario" (click)="reconciliacao.set('ociosa')">Fechar aviso</button>
            } @else {
              <button type="button" class="botao-principal" [disabled]="reconciliacao() === 'enviando'" (click)="reconciliar()">
                {{ reconciliacao() === 'enviando' ? 'Reconciliando…' : 'Reconciliar agora' }}
              </button>
            }
          </div>
        </section>
      }

      <main id="conteudo" tabindex="-1" class="mx-auto max-w-6xl px-4 py-6 outline-none sm:py-8">
        <router-outlet />
      </main>

      <footer class="mx-auto max-w-6xl px-4 pb-8 text-xs text-suave">
        PULSO · projeto de portfólio A-002. Não é sistema fiscal, contábil nem produto para uso empresarial real.
        <span class="hidden sm:inline">Atalho: <kbd class="font-mono">Ctrl K</kbd> ou <kbd class="font-mono">/</kbd> para buscar.</span>
      </footer>
    </div>

    <pulso-paleta />
  `,
})
export class App {
  protected readonly api = inject(PulsoApi);
  private readonly router = inject(Router);
  private readonly injector = inject(Injector);
  private readonly paleta = viewChild.required(PaletaComandos);

  protected readonly menu: ItemMenu[] = [
    { rota: '/visao-geral', rotulo: 'Visão geral', icone: 'painel', exato: true },
    { rota: '/produtos', rotulo: 'Produtos', icone: 'produtos', exato: false },
    { rota: '/vendas', rotulo: 'Vendas', icone: 'vendas', exato: false },
    { rota: '/entrada', rotulo: 'Registrar entrada', icone: 'entrada', exato: true },
    { rota: '/reposicao', rotulo: 'Reposição', icone: 'reposicao', exato: true },
    { rota: '/fornecedores', rotulo: 'Fornecedores', icone: 'fornecedores', exato: true },
  ];

  protected readonly menuAberto = signal(false);
  protected readonly reconciliacao = signal<'ociosa' | 'enviando' | 'concluida' | 'falhou'>('ociosa');
  protected readonly mensagemReconciliacao = signal('');

  constructor() {
    let primeira = true;
    const assinatura = this.router.events.pipe(filter((e) => e instanceof NavigationEnd)).subscribe(() => {
      this.menuAberto.set(false);
      if (primeira) {
        primeira = false;
        return;
      }
      // Leva o foco ao título da nova página, para leitores de tela e teclado.
      afterNextRender(() => document.querySelector<HTMLElement>('main h1')?.focus(), { injector: this.injector });
    });
    inject(DestroyRef).onDestroy(() => assinatura.unsubscribe());
  }

  protected abrirBusca(): void {
    this.menuAberto.set(false);
    this.paleta().abrir();
  }

  protected pularParaConteudo(evento: Event): void {
    evento.preventDefault();
    document.getElementById('conteudo')?.focus();
  }

  protected async reconciliar(): Promise<void> {
    if (this.reconciliacao() === 'enviando') return;
    this.reconciliacao.set('enviando');
    const resultado = await this.api.reconciliarPendencias();
    if (resultado.ok) {
      this.reconciliacao.set('concluida');
    } else {
      this.mensagemReconciliacao.set(resultado.erro.mensagem);
      this.reconciliacao.set('falhou');
    }
  }
}
