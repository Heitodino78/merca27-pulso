import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { ListaProdutos } from '../nucleo/contratos';
import { PulsoApi } from '../nucleo/pulso-api';
import { Carga, Carregando, FalhaConsulta, Vazio } from '../ui/carga';
import { BrlPipe, InteiroPipe, RotuloCategoriaPipe } from '../ui/formatos';

type Filtro = 'todos' | 'ativos' | 'inativos' | 'repor';

@Component({
  selector: 'pulso-produtos',
  imports: [RouterLink, Carregando, FalhaConsulta, Vazio, BrlPipe, InteiroPipe, RotuloCategoriaPipe],
  template: `
    <div class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 tabindex="-1" class="text-2xl font-extrabold tracking-tight sm:text-3xl">Produtos</h1>
        <p class="mt-1 text-sm text-suave">Saldo calculado a partir dos movimentos confirmados.</p>
      </div>
      <a routerLink="/produtos/novo" class="botao-principal self-start sm:self-auto">Cadastrar produto</a>
    </div>

    <div class="mt-6 grid gap-3 sm:grid-cols-[1fr_auto]" role="search">
      <div>
        <label for="busca-produtos" class="rotulo">Buscar por SKU ou nome</label>
        <input id="busca-produtos" type="search" class="campo-entrada" autocomplete="off" placeholder="Ex.: MER-001 ou arroz"
               [value]="busca()" (input)="busca.set($any($event.target).value)" />
      </div>
      <div>
        <label for="filtro-produtos" class="rotulo">Mostrar</label>
        <select id="filtro-produtos" class="campo-entrada" [value]="filtro()" (change)="filtro.set($any($event.target).value)">
          <option value="todos">Todos</option>
          <option value="ativos">Somente ativos</option>
          <option value="inativos">Somente inativos</option>
          <option value="repor">Com reposição sugerida</option>
        </select>
      </div>
    </div>

    <section class="mt-6" aria-labelledby="titulo-lista">
      <h2 id="titulo-lista" class="sr-only">Lista de produtos</h2>
      @switch (carga.estado().fase) {
        @case ('carregando') { <pulso-carregando texto="Carregando produtos…" /> }
        @case ('falha') {
          @if (carga.estado(); as e) { @if (e.fase === 'falha') { <pulso-falha-consulta [erro]="e.erro" (tentarDeNovo)="carregar()" /> } }
        }
        @case ('pronto') {
          @if (total() === 0) {
            <pulso-vazio titulo="Nenhum produto cadastrado" texto="Cadastre o primeiro produto ou aplique a seed fictícia pela CLI.">
              <a routerLink="/produtos/novo" class="botao-principal">Cadastrar produto</a>
            </pulso-vazio>
          } @else if (visiveis().length === 0) {
            <pulso-vazio titulo="Nenhum produto corresponde à busca" texto="Revise o termo ou o filtro selecionado.">
              <button type="button" class="botao-secundario" (click)="limpar()">Limpar busca e filtro</button>
            </pulso-vazio>
          } @else {
            <p class="mb-3 text-sm text-suave" role="status">{{ visiveis().length }} de {{ total() }} produto(s).</p>

            <ul class="grid gap-3 md:hidden">
              @for (p of visiveis(); track p.sku) {
                <li class="cartao cartao-interativo entrar">
                  <a [routerLink]="['/produtos', p.sku]" class="block rounded-sm">
                    <span class="font-mono text-xs text-suave">{{ p.sku }}</span>
                    <span class="block font-semibold text-texto underline decoration-borda underline-offset-4">{{ p.nome }}</span>
                  </a>
                  <dl class="mt-3 grid grid-cols-3 gap-2 text-sm">
                    <div><dt class="text-suave">Saldo</dt><dd class="font-bold">{{ p.saldoAtual | inteiro }}</dd></div>
                    <div><dt class="text-suave">Mínimo</dt><dd>{{ p.estoqueMinimo | inteiro }}</dd></div>
                    <div><dt class="text-suave">Preço</dt><dd>{{ p.precoVendaCentavos | brl }}</dd></div>
                  </dl>
                  <div class="mt-2 flex flex-wrap gap-2">
                    @if (!p.ativo) { <span class="rounded-sm bg-fundo px-2 py-0.5 text-xs font-semibold text-suave ring-1 ring-borda">Inativo</span> }
                    @if (repor().has(p.sku)) { <span class="rounded-sm bg-ambar px-2 py-0.5 text-xs font-semibold text-texto">Reposição sugerida</span> }
                  </div>
                </li>
              }
            </ul>

            <div class="entrar hidden overflow-x-auto rounded-xl border border-borda bg-superficie shadow-cartao md:block">
              <table class="w-full text-left text-sm">
                <caption class="sr-only">Produtos, saldos e situação</caption>
                <thead class="bg-fundo text-xs uppercase tracking-wide text-suave">
                  <tr>
                    <th scope="col" class="px-4 py-3">SKU</th>
                    <th scope="col" class="px-4 py-3">Produto</th>
                    <th scope="col" class="px-4 py-3">Categoria</th>
                    <th scope="col" class="px-4 py-3 text-right">Preço</th>
                    <th scope="col" class="px-4 py-3 text-right">Saldo</th>
                    <th scope="col" class="px-4 py-3 text-right">Mín. / alvo</th>
                    <th scope="col" class="px-4 py-3">Situação</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-borda">
                  @for (p of visiveis(); track p.sku) {
                    <tr class="hover:bg-destaque/40 motion-safe:transition-colors">
                      <td class="px-4 py-3 font-mono text-xs">{{ p.sku }}</td>
                      <td class="px-4 py-3">
                        <a [routerLink]="['/produtos', p.sku]" class="font-semibold text-verde-escuro underline decoration-borda underline-offset-4 hover:decoration-verde">{{ p.nome }}</a>
                      </td>
                      <td class="px-4 py-3">{{ p.categoria | rotuloCategoria }}</td>
                      <td class="px-4 py-3 text-right tabular-nums">{{ p.precoVendaCentavos | brl }}</td>
                      <td class="px-4 py-3 text-right font-bold tabular-nums">{{ p.saldoAtual | inteiro }}</td>
                      <td class="px-4 py-3 text-right tabular-nums text-suave">{{ p.estoqueMinimo }} / {{ p.estoqueAlvo }}</td>
                      <td class="px-4 py-3">
                        <div class="flex flex-wrap gap-1">
                          @if (p.ativo) { <span class="rounded-sm bg-destaque px-2 py-0.5 text-xs font-semibold text-verde-escuro">Ativo</span> }
                          @else { <span class="rounded-sm bg-fundo px-2 py-0.5 text-xs font-semibold text-suave ring-1 ring-borda">Inativo</span> }
                          @if (repor().has(p.sku)) { <span class="rounded-sm bg-ambar px-2 py-0.5 text-xs font-semibold text-texto">Repor</span> }
                        </div>
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          }
        }
      }
    </section>
  `,
})
export class ProdutosPagina {
  private readonly api = inject(PulsoApi);
  protected readonly carga = new Carga<ListaProdutos>(() => this.api.listarProdutos());
  // A marcação "repor" vem da consulta de reposição do núcleo, não de uma regra local.
  private readonly reposicao = new Carga(() => this.api.consultarReposicao());
  protected readonly busca = signal('');
  protected readonly filtro = signal<Filtro>('todos');

  protected readonly total = computed(() => this.carga.valor?.produtos.length ?? 0);
  protected readonly repor = computed(() => new Set(this.reposicao.valor?.itens.map((i) => i.sku) ?? []));
  protected readonly visiveis = computed(() => {
    const termo = this.busca().trim().toLocaleLowerCase('pt-BR');
    const filtro = this.filtro();
    const repor = this.repor();
    return (this.carga.valor?.produtos ?? []).filter((p) => {
      if (filtro === 'ativos' && !p.ativo) return false;
      if (filtro === 'inativos' && p.ativo) return false;
      if (filtro === 'repor' && !repor.has(p.sku)) return false;
      return !termo || p.sku.toLocaleLowerCase('pt-BR').includes(termo) || p.nome.toLocaleLowerCase('pt-BR').includes(termo);
    });
  });

  constructor() {
    void this.carregar();
  }

  protected async carregar(): Promise<void> {
    await Promise.all([this.carga.carregar(), this.reposicao.carregar()]);
  }

  protected limpar(): void {
    this.busca.set('');
    this.filtro.set('todos');
  }
}
