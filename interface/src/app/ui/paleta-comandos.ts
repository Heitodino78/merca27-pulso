import { Component, ElementRef, Injector, afterNextRender, computed, inject, signal, viewChild } from '@angular/core';
import { Router } from '@angular/router';
import type { ListaProdutos } from '../nucleo/contratos';
import { formatarBRL } from '../nucleo/dinheiro';
import { PulsoApi } from '../nucleo/pulso-api';
import { Carga } from './carga';
import { Icone } from './icone';

export interface ItemPaleta {
  id: string;
  grupo: 'Páginas' | 'Ações' | 'Produtos';
  rotulo: string;
  detalhe: string;
  rota: string;
  icone: string;
}

export const ITENS_FIXOS: ItemPaleta[] = [
  { id: 'p-visao', grupo: 'Páginas', rotulo: 'Visão geral', detalhe: 'Indicadores do período', rota: '/visao-geral', icone: 'painel' },
  { id: 'p-produtos', grupo: 'Páginas', rotulo: 'Produtos', detalhe: 'Catálogo e saldos', rota: '/produtos', icone: 'produtos' },
  { id: 'p-vendas', grupo: 'Páginas', rotulo: 'Vendas', detalhe: 'Histórico e estornos', rota: '/vendas', icone: 'vendas' },
  { id: 'p-reposicao', grupo: 'Páginas', rotulo: 'Reposição', detalhe: 'Sugestões para revisão', rota: '/reposicao', icone: 'reposicao' },
  { id: 'p-fornecedores', grupo: 'Páginas', rotulo: 'Fornecedores', detalhe: 'Somente leitura', rota: '/fornecedores', icone: 'fornecedores' },
  { id: 'a-venda', grupo: 'Ações', rotulo: 'Registrar venda', detalhe: 'Vários itens, tudo ou nada', rota: '/vendas/nova', icone: 'mais' },
  { id: 'a-entrada', grupo: 'Ações', rotulo: 'Registrar entrada', detalhe: 'Fornecedor e custo', rota: '/entrada', icone: 'entrada' },
  { id: 'a-produto', grupo: 'Ações', rotulo: 'Cadastrar produto', detalhe: 'Novo SKU', rota: '/produtos/novo', icone: 'produtos' },
];

const LIMITE_PRODUTOS = 8;

/** Sem acentos e sem caixa: "agua" encontra "Água". */
export function normalizarBusca(texto: string): string {
  return texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

/**
 * Paleta de comandos: Ctrl+K (ou ⌘K) em qualquer lugar, ou "/" fora de campos de texto.
 * Só navega; não grava nada. Produtos vêm de listarProdutos, carregado na primeira abertura.
 */
@Component({
  selector: 'pulso-paleta',
  imports: [Icone],
  host: { '(document:keydown)': 'atalho($event)' },
  template: `
    @if (aberta()) {
      <div class="fixed inset-0 z-50 flex items-start justify-center bg-texto/40 p-4 pt-[10vh] backdrop-blur-sm motion-safe:animate-surgir" (click)="fechar()">
        <div role="dialog" aria-modal="true" aria-labelledby="paleta-titulo" class="w-full max-w-xl overflow-hidden rounded-2xl border border-borda bg-superficie shadow-elevada"
             (click)="$event.stopPropagation()" (keydown)="teclaDialogo($event)">
          <h2 id="paleta-titulo" class="sr-only">Ir para uma página, ação ou produto</h2>
          <div class="flex items-center gap-3 border-b border-borda px-4">
            <pulso-icone nome="busca" class="size-5 text-suave" />
            <input #campo type="text" role="combobox" aria-expanded="true" aria-controls="paleta-lista" aria-autocomplete="list"
                   aria-label="Buscar página, ação ou produto" [attr.aria-activedescendant]="ativoId()" autocomplete="off" spellcheck="false"
                   placeholder="Buscar página, ação ou produto…" class="h-14 min-w-0 flex-1 bg-transparent text-base text-texto outline-none placeholder:text-suave"
                   [value]="termo()" (input)="digitar($any($event.target).value)" />
            <kbd class="rounded border border-borda bg-fundo px-1.5 py-0.5 font-mono text-xs text-suave">Esc</kbd>
          </div>
          <ul id="paleta-lista" role="listbox" aria-label="Resultados" class="max-h-[50vh] overflow-auto p-2">
            @for (item of resultados(); track item.id; let i = $index) {
              @if (i === 0 || resultados()[i - 1]?.grupo !== item.grupo) {
                <li role="presentation" class="px-3 pb-1 pt-3 text-xs font-semibold uppercase tracking-wider text-suave">{{ item.grupo }}</li>
              }
              <li role="option" [id]="'paleta-op-' + i" [attr.aria-selected]="i === indice()" (click)="ir(item)" (mousemove)="indice.set(i)"
                  class="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-sm"
                  [class]="i === indice() ? 'bg-destaque text-verde-escuro' : 'text-texto'">
                <span class="rounded-md bg-fundo p-1.5"><pulso-icone [nome]="item.icone" class="size-4" /></span>
                <span class="min-w-0 flex-1"><span class="block truncate font-semibold">{{ item.rotulo }}</span>
                  <span class="block truncate text-xs text-suave">{{ item.detalhe }}</span></span>
                @if (i === indice()) { <pulso-icone nome="seta" class="size-4" /> }
              </li>
            } @empty {
              <li class="px-3 py-8 text-center text-sm text-suave">Nada encontrado para “{{ termo() }}”.</li>
            }
            @if (produtos.estado().fase === 'carregando') {
              <li class="px-3 py-2 text-xs text-suave">Carregando produtos…</li>
            }
          </ul>
          <p class="flex flex-wrap gap-x-4 gap-y-1 border-t border-borda bg-fundo px-4 py-2 text-xs text-suave">
            <span><kbd class="font-mono">↑ ↓</kbd> navegar</span><span><kbd class="font-mono">Enter</kbd> abrir</span><span><kbd class="font-mono">Esc</kbd> fechar</span>
          </p>
        </div>
      </div>
    }
  `,
})
export class PaletaComandos {
  private readonly api = inject(PulsoApi);
  private readonly router = inject(Router);
  private readonly injector = inject(Injector);
  private readonly campo = viewChild<ElementRef<HTMLInputElement>>('campo');
  private focoAnterior: HTMLElement | null = null;

  readonly aberta = signal(false);
  protected readonly termo = signal('');
  protected readonly indice = signal(0);
  protected readonly produtos = new Carga<ListaProdutos>(() => this.api.listarProdutos());
  private produtosPedidos = false;

  protected readonly resultados = computed<ItemPaleta[]>(() => {
    const termo = normalizarBusca(this.termo());
    const fixos = ITENS_FIXOS.filter((i) => !termo || normalizarBusca(`${i.rotulo} ${i.detalhe}`).includes(termo));
    const produtos = (this.produtos.valor?.produtos ?? [])
      .filter((p) => termo && normalizarBusca(`${p.sku} ${p.nome}`).includes(termo))
      .slice(0, LIMITE_PRODUTOS)
      .map((p): ItemPaleta => ({ id: `s-${p.sku}`, grupo: 'Produtos', rotulo: p.nome, icone: 'produtos', rota: `/produtos/${p.sku}`,
        detalhe: `${p.sku} · saldo ${p.saldoAtual} · ${formatarBRL(p.precoVendaCentavos)}${p.ativo ? '' : ' · inativo'}` }));
    return [...fixos, ...produtos];
  });
  protected readonly ativoId = computed(() => (this.resultados().length ? `paleta-op-${this.indice()}` : null));

  abrir(): void {
    if (this.aberta()) return;
    this.focoAnterior = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    this.termo.set('');
    this.indice.set(0);
    this.aberta.set(true);
    if (!this.produtosPedidos) {
      this.produtosPedidos = true;
      void this.produtos.carregar();
    }
    afterNextRender(() => this.campo()?.nativeElement.focus(), { injector: this.injector });
  }

  fechar(): void {
    if (!this.aberta()) return;
    this.aberta.set(false);
    this.focoAnterior?.focus();
  }

  protected atalho(evento: KeyboardEvent): void {
    if ((evento.ctrlKey || evento.metaKey) && evento.key.toLowerCase() === 'k') {
      evento.preventDefault();
      if (this.aberta()) this.fechar();
      else this.abrir();
      return;
    }
    if (evento.key === '/' && !this.aberta() && !digitando(evento.target)) {
      evento.preventDefault();
      this.abrir();
    }
  }

  protected digitar(valor: string): void {
    this.termo.set(valor);
    this.indice.set(0);
  }

  protected teclaDialogo(evento: KeyboardEvent): void {
    const total = this.resultados().length;
    switch (evento.key) {
      case 'Escape':
        evento.preventDefault();
        this.fechar();
        return;
      case 'ArrowDown':
        evento.preventDefault();
        if (total) this.indice.set((this.indice() + 1) % total);
        break;
      case 'ArrowUp':
        evento.preventDefault();
        if (total) this.indice.set((this.indice() - 1 + total) % total);
        break;
      case 'Enter': {
        evento.preventDefault();
        const item = this.resultados()[this.indice()];
        if (item) this.ir(item);
        return;
      }
      case 'Tab':
        // Foco preso no diálogo: o campo é o único elemento focável.
        evento.preventDefault();
        return;
      default:
        return;
    }
    afterNextRender(() => document.getElementById(`paleta-op-${this.indice()}`)?.scrollIntoView?.({ block: 'nearest' }), { injector: this.injector });
  }

  protected ir(item: ItemPaleta): void {
    this.focoAnterior = null;
    this.aberta.set(false);
    void this.router.navigateByUrl(item.rota);
  }
}

function digitando(alvo: EventTarget | null): boolean {
  if (!(alvo instanceof HTMLElement)) return false;
  return alvo.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(alvo.tagName);
}
