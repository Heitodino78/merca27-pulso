import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { ConsultaReposicao } from '../nucleo/contratos';
import { PulsoApi } from '../nucleo/pulso-api';
import { Carga, Carregando, FalhaConsulta, Vazio } from '../ui/carga';
import { InteiroPipe } from '../ui/formatos';

@Component({
  selector: 'pulso-reposicao',
  imports: [RouterLink, Carregando, FalhaConsulta, Vazio, InteiroPipe],
  template: `
    <h1 tabindex="-1" class="text-2xl font-extrabold tracking-tight sm:text-3xl">Reposição sugerida</h1>
    <p class="mt-1 max-w-2xl text-sm text-suave">
      Regra do PULSO: produto ativo com saldo menor ou igual ao mínimo; sugestão = alvo − saldo.
      É uma sugestão para revisão humana: nenhuma compra é feita automaticamente.
    </p>
    <section class="mt-6" aria-labelledby="titulo-itens">
      <h2 id="titulo-itens" class="sr-only">Itens com reposição sugerida</h2>
      @switch (carga.estado().fase) {
        @case ('carregando') { <pulso-carregando texto="Consultando reposição…" /> }
        @case ('falha') {
          @if (carga.estado(); as e) { @if (e.fase === 'falha') { <pulso-falha-consulta [erro]="e.erro" (tentarDeNovo)="carga.carregar()" /> } }
        }
        @case ('pronto') {
          @if (carga.valor; as r) {
            @if (r.itens.length === 0) {
              <pulso-vazio titulo="Nenhum produto precisa de reposição agora" texto="Todos os produtos ativos estão acima do estoque mínimo." />
            } @else {
              <p class="mb-3 text-sm text-suave" role="status">{{ r.itens.length }} produto(s) no mínimo ou abaixo dele. {{ r.aviso }}</p>
              <ul class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                @for (i of r.itens; track i.sku) {
                  <li class="cartao cartao-interativo entrar flex flex-col border-l-4 border-l-ambar">
                    <p class="font-mono text-xs text-suave">{{ i.sku }}</p>
                    <h3 class="font-semibold"><a [routerLink]="['/produtos', i.sku]" class="underline decoration-borda underline-offset-4 hover:decoration-verde">{{ i.nome }}</a></h3>
                    <dl class="mt-3 grid grid-cols-3 gap-2 text-sm">
                      <div><dt class="text-suave">Saldo</dt><dd class="font-bold tabular-nums">{{ i.saldoAtual | inteiro }}</dd></div>
                      <div><dt class="text-suave">Mínimo</dt><dd class="tabular-nums">{{ i.estoqueMinimo }}</dd></div>
                      <div><dt class="text-suave">Alvo</dt><dd class="tabular-nums">{{ i.estoqueAlvo }}</dd></div>
                    </dl>
                    <p class="mt-3 rounded-md bg-ambar-claro px-3 py-2 text-sm"><strong>Sugestão: {{ i.sugestaoUnidades }} unidade(s)</strong></p>
                    <p class="mt-2 text-sm text-suave">Fornecedor: {{ i.fornecedor ? i.fornecedor.fornecedor_id + ' — ' + i.fornecedor.nome_ficticio : 'não cadastrado' }}</p>
                    <a [routerLink]="['/entrada']" [queryParams]="{ sku: i.sku }" class="botao-secundario mt-3 self-start">Registrar entrada</a>
                  </li>
                }
              </ul>
            }
          }
        }
      }
    </section>
  `,
})
export class ReposicaoPagina {
  private readonly api = inject(PulsoApi);
  protected readonly carga = new Carga<ConsultaReposicao>(() => this.api.consultarReposicao());

  constructor() {
    void this.carga.carregar();
  }
}
