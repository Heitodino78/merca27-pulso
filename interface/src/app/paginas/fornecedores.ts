import { Component, computed, inject, signal } from '@angular/core';
import type { ListaFornecedores } from '../nucleo/contratos';
import { PulsoApi } from '../nucleo/pulso-api';
import { Carga, Carregando, FalhaConsulta, Vazio } from '../ui/carga';
import { DataHoraPipe, RotuloCategoriaPipe } from '../ui/formatos';

@Component({
  selector: 'pulso-fornecedores',
  imports: [Carregando, FalhaConsulta, Vazio, DataHoraPipe, RotuloCategoriaPipe],
  template: `
    <h1 tabindex="-1" class="text-2xl font-extrabold tracking-tight sm:text-3xl">Fornecedores</h1>
    <p class="mt-1 max-w-2xl text-sm text-suave">Fornecedores inteiramente fictícios, sem dados de contato. Consulta somente leitura.</p>
    <div class="mt-6 max-w-md" role="search">
      <label for="busca-fornecedores" class="rotulo">Buscar por código, nome ou categoria</label>
      <input id="busca-fornecedores" type="search" class="campo-entrada" autocomplete="off" placeholder="Ex.: FOR-001"
             [value]="busca()" (input)="busca.set($any($event.target).value)" />
    </div>
    <section class="mt-6" aria-labelledby="titulo-fornecedores">
      <h2 id="titulo-fornecedores" class="sr-only">Lista de fornecedores</h2>
      @switch (carga.estado().fase) {
        @case ('carregando') { <pulso-carregando texto="Carregando fornecedores…" /> }
        @case ('falha') {
          @if (carga.estado(); as e) { @if (e.fase === 'falha') { <pulso-falha-consulta [erro]="e.erro" (tentarDeNovo)="carga.carregar()" /> } }
        }
        @case ('pronto') {
          @if (total() === 0) {
            <pulso-vazio titulo="Nenhum fornecedor cadastrado" texto="Aplique a seed fictícia pela CLI para cadastrar os seis fornecedores." />
          } @else if (visiveis().length === 0) {
            <pulso-vazio titulo="Nenhum fornecedor corresponde à busca">
              <button type="button" class="botao-secundario" (click)="busca.set('')">Limpar busca</button>
            </pulso-vazio>
          } @else {
            <p class="mb-3 text-sm text-suave" role="status">{{ visiveis().length }} de {{ total() }} fornecedor(es).</p>
            <ul class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              @for (f of visiveis(); track f.fornecedor_id) {
                <li class="cartao">
                  <p class="font-mono text-xs text-suave">{{ f.fornecedor_id }}</p>
                  <h3 class="font-semibold">{{ f.nome_ficticio }}</h3>
                  <dl class="mt-2 grid grid-cols-2 gap-2 text-sm">
                    <div><dt class="text-suave">Categoria</dt><dd>{{ f.categoria_principal | rotuloCategoria }}</dd></div>
                    <div><dt class="text-suave">Prazo estimado</dt><dd>{{ f.prazo_estimado_dias }} dia(s)</dd></div>
                    <div><dt class="text-suave">Situação</dt><dd>{{ f.ativo ? 'Ativo' : 'Inativo' }}</dd></div>
                    <div><dt class="text-suave">Cadastro</dt><dd>{{ f.criado_em | dataHora }}</dd></div>
                  </dl>
                </li>
              }
            </ul>
          }
        }
      }
    </section>
  `,
})
export class FornecedoresPagina {
  private readonly api = inject(PulsoApi);
  protected readonly carga = new Carga<ListaFornecedores>(() => this.api.listarFornecedores());
  protected readonly busca = signal('');
  protected readonly total = computed(() => this.carga.valor?.fornecedores.length ?? 0);
  protected readonly visiveis = computed(() => {
    const termo = this.busca().trim().toLocaleLowerCase('pt-BR');
    return (this.carga.valor?.fornecedores ?? []).filter((f) => !termo ||
      [f.fornecedor_id, f.nome_ficticio, f.categoria_principal].some((t) => t.toLocaleLowerCase('pt-BR').includes(termo)));
  });

  constructor() {
    void this.carga.carregar();
  }
}
