import { Component, DestroyRef, Injector, afterNextRender, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { PulsoApi } from './nucleo/pulso-api';

@Component({
  selector: 'pulso-raiz',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <a href="#conteudo" (click)="pularParaConteudo($event)"
       class="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-superficie focus:px-4 focus:py-2 focus:font-semibold focus:text-verde">
      Pular para o conteúdo
    </a>

    <header class="border-b border-borda bg-superficie">
      <div class="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-3 md:flex-row md:items-center md:justify-between">
        <a routerLink="/produtos" class="flex items-baseline gap-2 self-start rounded-sm">
          <span class="text-xl font-extrabold tracking-tight text-verde">PULSO</span>
          <span class="text-sm font-medium text-suave">MERCA 27 · gestão operacional</span>
        </a>
        <nav aria-label="Principal">
          <ul class="grid grid-cols-2 gap-1 sm:flex sm:flex-wrap">
            @for (item of menu; track item.rota) {
              <li>
                <a [routerLink]="item.rota" routerLinkActive="bg-destaque text-verde-escuro"
                   [routerLinkActiveOptions]="{ exact: item.exato }" ariaCurrentWhenActive="page"
                   class="flex min-h-11 items-center rounded-md px-3 text-sm font-semibold text-texto hover:bg-destaque">
                  {{ item.rotulo }}
                </a>
              </li>
            }
          </ul>
        </nav>
      </div>
    </header>

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
    </footer>
  `,
})
export class App {
  protected readonly api = inject(PulsoApi);
  private readonly router = inject(Router);
  private readonly injector = inject(Injector);

  protected readonly menu = [
    { rota: '/produtos', rotulo: 'Produtos', exato: false },
    { rota: '/vendas', rotulo: 'Vendas', exato: false },
    { rota: '/entrada', rotulo: 'Registrar entrada', exato: true },
    { rota: '/reposicao', rotulo: 'Reposição', exato: true },
    { rota: '/fornecedores', rotulo: 'Fornecedores', exato: true },
  ];

  protected readonly reconciliacao = signal<'ociosa' | 'enviando' | 'concluida' | 'falhou'>('ociosa');
  protected readonly mensagemReconciliacao = signal('');

  constructor() {
    let primeira = true;
    const assinatura = this.router.events.pipe(filter((e) => e instanceof NavigationEnd)).subscribe(() => {
      if (primeira) {
        primeira = false;
        return;
      }
      // Leva o foco ao título da nova página, para leitores de tela e teclado.
      afterNextRender(() => document.querySelector<HTMLElement>('main h1')?.focus(), { injector: this.injector });
    });
    inject(DestroyRef).onDestroy(() => assinatura.unsubscribe());
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
