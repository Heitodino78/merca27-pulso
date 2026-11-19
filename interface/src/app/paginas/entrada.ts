import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { FormEntrada } from '../formularios/form-entrada';
import type { ListaFornecedores, ListaProdutos } from '../nucleo/contratos';
import { PulsoApi } from '../nucleo/pulso-api';
import { Carga, Carregando, FalhaConsulta, Vazio } from '../ui/carga';

@Component({
  selector: 'pulso-entrada',
  imports: [RouterLink, FormEntrada, Carregando, FalhaConsulta, Vazio],
  template: `
    <h1 tabindex="-1" class="text-2xl font-extrabold tracking-tight sm:text-3xl">Registrar entrada</h1>
    <p class="mt-1 max-w-2xl text-sm text-suave">
      Fornecedor e custo unitário são obrigatórios. O saldo só muda depois que o PULSO confirma a gravação.
    </p>
    <div class="cartao mt-6 max-w-3xl">
      @if (produtos.estado().fase === 'carregando' || fornecedores.estado().fase === 'carregando') {
        <pulso-carregando texto="Carregando produtos e fornecedores…" />
      } @else if (falha(); as erro) {
        <pulso-falha-consulta [erro]="erro" (tentarDeNovo)="carregar()" />
      } @else if (listaProdutos().length === 0) {
        <pulso-vazio titulo="Nenhum produto cadastrado" texto="Cadastre um produto antes de registrar entradas.">
          <a routerLink="/produtos/novo" class="botao-principal">Cadastrar produto</a>
        </pulso-vazio>
      } @else if (listaFornecedores().length === 0) {
        <pulso-vazio titulo="Nenhum fornecedor cadastrado" texto="Toda entrada exige um fornecedor. Aplique a seed fictícia pela CLI." />
      } @else {
        <pulso-form-entrada [produtos]="listaProdutos()" [fornecedores]="listaFornecedores()" [skuInicial]="skuInicial()"
                            (registrado)="produtos.carregar(true)" />
      }
    </div>
  `,
})
export class EntradaPagina {
  private readonly api = inject(PulsoApi);
  protected readonly produtos = new Carga<ListaProdutos>(() => this.api.listarProdutos());
  protected readonly fornecedores = new Carga<ListaFornecedores>(() => this.api.listarFornecedores());
  protected readonly listaProdutos = computed(() => this.produtos.valor?.produtos ?? []);
  protected readonly listaFornecedores = computed(() => this.fornecedores.valor?.fornecedores ?? []);
  protected readonly skuInicial = toSignal(inject(ActivatedRoute).queryParamMap.pipe(map((q) => q.get('sku'))), { initialValue: null });
  protected readonly falha = computed(() => {
    const p = this.produtos.estado();
    const f = this.fornecedores.estado();
    return p.fase === 'falha' ? p.erro : f.fase === 'falha' ? f.erro : null;
  });

  constructor() {
    void this.carregar();
  }

  protected async carregar(): Promise<void> {
    await Promise.all([this.produtos.carregar(), this.fornecedores.carregar()]);
  }
}
