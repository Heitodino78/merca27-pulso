import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormAdministrativo, type TipoAdministrativo } from '../formularios/form-administrativo';
import { FormAlteracao, FormStatus } from '../formularios/form-alteracao';
import { FormEntrada } from '../formularios/form-entrada';
import type { ConsultaEstoque, ConsultaReposicao, HistoricoProduto, ListaFornecedores, VersaoProduto } from '../nucleo/contratos';
import { formatarBRL } from '../nucleo/dinheiro';
import { PulsoApi } from '../nucleo/pulso-api';
import { Carga, Carregando, FalhaConsulta, Vazio } from '../ui/carga';
import { BrlPipe, DataHoraPipe, DeltaPipe, InteiroPipe, RotuloCategoriaPipe, TipoMovimentoPipe } from '../ui/formatos';

type Painel = 'ENTRADA' | TipoAdministrativo;

const ROTULOS_CAMPOS: Record<string, string> = {
  nome: 'Nome', categoria_id: 'Categoria', preco_venda_centavos: 'Preço', custo_ref_centavos: 'Custo de referência',
  estoque_minimo: 'Mínimo', estoque_alvo: 'Alvo', fornecedor_id: 'Fornecedor', ativo: 'Situação',
};

@Component({
  selector: 'pulso-produto-detalhe',
  imports: [
    RouterLink, Carregando, FalhaConsulta, Vazio, FormEntrada, FormAdministrativo, FormAlteracao, FormStatus,
    BrlPipe, DataHoraPipe, DeltaPipe, InteiroPipe, RotuloCategoriaPipe, TipoMovimentoPipe,
  ],
  template: `
    <nav aria-label="Trilha" class="mb-3 text-sm"><a routerLink="/produtos" class="text-verde-escuro underline">Produtos</a> / {{ sku() }}</nav>

    @switch (estoque.estado().fase) {
      @case ('carregando') {
        <h1 tabindex="-1" class="mb-4 text-2xl font-extrabold">Produto {{ sku() }}</h1>
        <pulso-carregando texto="Carregando produto e histórico…" />
      }
      @case ('falha') {
        <h1 tabindex="-1" class="mb-4 text-2xl font-extrabold">Produto {{ sku() }}</h1>
        @if (estoque.estado(); as e) { @if (e.fase === 'falha') {
          <pulso-falha-consulta [erro]="e.erro" [titulo]="e.erro.codigo === 'SKU_INEXISTENTE' ? 'Produto não encontrado.' : 'Não foi possível carregar o produto.'" (tentarDeNovo)="carregar()" />
        } }
      }
      @case ('pronto') {
        @if (estoque.valor; as p) {
          @for (chave of [p.sku]; track chave) {
          <header class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p class="font-mono text-sm text-suave">{{ p.sku }} · {{ p.categoria | rotuloCategoria }} · {{ p.unidade }}</p>
              <h1 tabindex="-1" class="text-2xl font-extrabold tracking-tight sm:text-3xl">{{ p.nome }}</h1>
              <div class="mt-2 flex flex-wrap gap-2">
                @if (p.ativo) { <span class="rounded-sm bg-destaque px-2 py-0.5 text-xs font-semibold text-verde-escuro">Ativo</span> }
                @else { <span class="rounded-sm bg-fundo px-2 py-0.5 text-xs font-semibold text-suave ring-1 ring-borda">Inativo: não aceita entradas</span> }
                @if (itemReposicao(); as r) {
                  <span class="rounded-sm bg-ambar px-2 py-0.5 text-xs font-semibold text-texto">Reposição sugerida: {{ r.sugestaoUnidades }} un.</span>
                }
              </div>
            </div>
          </header>

          <dl class="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <div class="cartao col-span-2 lg:col-span-1">
              <dt class="text-sm font-semibold text-suave">Saldo atual</dt>
              <dd class="mt-1 text-4xl font-extrabold tabular-nums text-verde-escuro">{{ p.saldoAtual | inteiro }}<span class="ml-1 text-base font-semibold text-suave">un.</span></dd>
              <dd class="mt-1 text-xs text-suave">Soma de {{ p.totalMovimentos }} movimento(s) confirmado(s).</dd>
            </div>
            <div class="cartao"><dt class="text-sm font-semibold text-suave">Mínimo / alvo</dt><dd class="mt-1 text-xl font-bold tabular-nums">{{ p.estoqueMinimo }} / {{ p.estoqueAlvo }}</dd></div>
            <div class="cartao"><dt class="text-sm font-semibold text-suave">Preço de venda</dt><dd class="mt-1 text-xl font-bold tabular-nums">{{ p.precoVendaCentavos | brl }}</dd></div>
            <div class="cartao col-span-2 lg:col-span-1">
              <dt class="text-sm font-semibold text-suave">Custo de referência</dt><dd class="mt-1 text-xl font-bold tabular-nums">{{ p.custoRefCentavos | brl }}</dd>
              <dd class="mt-1 text-xs text-suave">Fornecedor: {{ p.fornecedorId ?? 'nenhum' }}</dd>
            </div>
          </dl>

          <section class="cartao mt-6" aria-labelledby="titulo-movimentar">
            <h2 id="titulo-movimentar" class="text-lg font-bold">Movimentar estoque</h2>
            <div class="mt-3 flex flex-wrap gap-2" role="group" aria-label="Tipo de movimento">
              @for (opcao of paineis; track opcao.id) {
                <button type="button" [attr.aria-pressed]="painel() === opcao.id" (click)="painel.set(opcao.id)"
                        class="min-h-11 rounded-md border px-3 text-sm font-semibold motion-safe:transition-colors"
                        [class]="painel() === opcao.id ? 'border-verde bg-verde text-white' : 'border-borda bg-superficie text-texto hover:bg-destaque'">
                  {{ opcao.rotulo }}
                </button>
              }
            </div>
            <div class="mt-4">
              <div [hidden]="painel() !== 'ENTRADA'">
                @if (!p.ativo) {
                  <p class="mb-3 rounded-md border-l-4 border-ambar bg-ambar-claro p-3 text-sm">Produto inativo: o PULSO recusará a entrada até a reativação.</p>
                }
                <pulso-form-entrada [skuFixo]="p.sku" [fornecedores]="listaFornecedores()" [custoReferencia]="p.custoRefCentavos"
                                    [fornecedorDoCadastro]="p.fornecedorId" (registrado)="atualizar()" />
              </div>
              <div [hidden]="painel() !== 'SALDO_INICIAL'"><pulso-form-administrativo tipo="SALDO_INICIAL" [sku]="p.sku" (registrado)="atualizar()" /></div>
              <div [hidden]="painel() !== 'PERDA'"><pulso-form-administrativo tipo="PERDA" [sku]="p.sku" (registrado)="atualizar()" /></div>
              <div [hidden]="painel() !== 'AJUSTE'"><pulso-form-administrativo tipo="AJUSTE" [sku]="p.sku" (registrado)="atualizar()" /></div>
            </div>
          </section>

          <section class="mt-6" aria-labelledby="titulo-historico">
            <div class="flex flex-wrap items-baseline justify-between gap-2">
              <h2 id="titulo-historico" class="text-lg font-bold">Histórico de movimentos</h2>
              @if (p.totalMovimentos > p.historico.length) {
                <button type="button" class="text-sm font-semibold text-verde-escuro underline" (click)="verTudo()">
                  Ver todos os {{ p.totalMovimentos }} movimentos
                </button>
              }
            </div>
            <p class="mt-1 text-sm text-suave">Exibindo {{ p.historico.length }} de {{ p.totalMovimentos }}, do mais recente ao mais antigo.</p>
            @if (p.historico.length === 0) {
              <div class="mt-3"><pulso-vazio titulo="Nenhum movimento confirmado" texto="Registre o saldo inicial ou uma entrada para começar o histórico." /></div>
            } @else {
              <div class="mt-3 overflow-x-auto rounded-lg border border-borda bg-superficie">
                <table class="w-full min-w-[40rem] text-left text-sm">
                  <caption class="sr-only">Movimentos de {{ p.sku }} com saldo após cada um</caption>
                  <thead class="bg-fundo text-xs uppercase tracking-wide text-suave">
                    <tr>
                      <th scope="col" class="px-3 py-2">Quando</th>
                      <th scope="col" class="px-3 py-2">Tipo</th>
                      <th scope="col" class="px-3 py-2 text-right">Unidades</th>
                      <th scope="col" class="px-3 py-2 text-right">Saldo após</th>
                      <th scope="col" class="px-3 py-2">Custo unit.</th>
                      <th scope="col" class="px-3 py-2">Detalhes</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-borda">
                    @for (m of historicoRecente(); track m.movimentoId) {
                      <tr>
                        <td class="whitespace-nowrap px-3 py-2">{{ m.registradoEm | dataHora }}</td>
                        <td class="px-3 py-2 font-semibold">{{ m.tipo | tipoMovimento }}</td>
                        <td class="px-3 py-2 text-right font-semibold tabular-nums" [class.text-erro]="m.deltaUnidades < 0">{{ m.deltaUnidades | delta }}</td>
                        <td class="px-3 py-2 text-right font-bold tabular-nums">{{ m.saldoApos | inteiro }}</td>
                        <td class="px-3 py-2 tabular-nums">{{ m.custoUnitCentavos | brl }}</td>
                        <td class="px-3 py-2 text-suave">
                          @if (m.fornecedorId) { {{ m.fornecedorId }} }
                          @if (m.referenciaId) { · ref. {{ m.referenciaId }} }
                          @if (m.categoriaPerda) { {{ m.categoriaPerda | rotuloCategoria }} · }
                          @if (m.saldoAnterior !== null) { contado {{ m.saldoNovo }} (era {{ m.saldoAnterior }}) · }
                          {{ m.motivo ?? '' }}
                        </td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            }
          </section>

          <div class="mt-6 grid gap-6 lg:grid-cols-2">
            <section class="cartao" aria-labelledby="titulo-cadastro">
              <h2 id="titulo-cadastro" class="text-lg font-bold">Alterar cadastro</h2>
              <p class="mb-4 mt-1 text-sm text-suave">SKU e unidade não mudam. Cada alteração vira uma nova versão, com motivo.</p>
              <pulso-form-alteracao [produto]="p" [fornecedores]="listaFornecedores()" (alterado)="atualizar()" />
            </section>
            <div class="space-y-6">
              <section class="cartao" aria-labelledby="titulo-status">
                <h2 id="titulo-status" class="text-lg font-bold">{{ p.ativo ? 'Desativar produto' : 'Reativar produto' }}</h2>
                <div class="mt-3"><pulso-form-status [sku]="p.sku" [ativo]="p.ativo" (alterado)="atualizar()" /></div>
              </section>
              <section class="cartao" aria-labelledby="titulo-versoes">
                <h2 id="titulo-versoes" class="text-lg font-bold">Versões do cadastro</h2>
                @switch (historico.estado().fase) {
                  @case ('carregando') { <div class="mt-3"><pulso-carregando texto="Carregando versões…" /></div> }
                  @case ('falha') {
                    @if (historico.estado(); as e) { @if (e.fase === 'falha') { <div class="mt-3"><pulso-falha-consulta [erro]="e.erro" (tentarDeNovo)="historico.carregar()" /></div> } }
                  }
                  @case ('pronto') {
                    <ol class="mt-3 space-y-3" reversed>
                      @for (v of versoesRecentes(); track v.operacaoId; let i = $index) {
                        <li class="border-l-4 pl-3" [class]="i === 0 ? 'border-verde' : 'border-borda'">
                          <p class="text-sm font-semibold">{{ v.registradoEm | dataHora }} · {{ v.motivo }}</p>
                          <p class="text-sm text-suave">{{ resumoVersao(v) }}</p>
                        </li>
                      }
                    </ol>
                  }
                }
              </section>
            </div>
          </div>
          }
        }
      }
    }
  `,
})
export class ProdutoDetalhePagina {
  private readonly api = inject(PulsoApi);
  protected readonly sku = signal('');
  private limite: number | undefined;

  protected readonly estoque = new Carga<ConsultaEstoque>(() => this.api.consultarEstoque(this.sku(), this.limite));
  protected readonly historico = new Carga<HistoricoProduto>(() => this.api.consultarHistoricoProduto(this.sku()));
  private readonly fornecedores = new Carga<ListaFornecedores>(() => this.api.listarFornecedores());
  private readonly reposicao = new Carga<ConsultaReposicao>(() => this.api.consultarReposicao());

  protected readonly painel = signal<Painel>('ENTRADA');
  protected readonly paineis: { id: Painel; rotulo: string }[] = [
    { id: 'ENTRADA', rotulo: 'Entrada' },
    { id: 'SALDO_INICIAL', rotulo: 'Saldo inicial' },
    { id: 'PERDA', rotulo: 'Perda' },
    { id: 'AJUSTE', rotulo: 'Ajuste por contagem' },
  ];

  protected readonly listaFornecedores = computed(() => this.fornecedores.valor?.fornecedores ?? []);
  protected readonly itemReposicao = computed(() => this.reposicao.valor?.itens.find((i) => i.sku === this.sku()) ?? null);
  protected readonly historicoRecente = computed(() => [...(this.estoque.valor?.historico ?? [])].reverse());
  protected readonly versoesRecentes = computed(() => [...(this.historico.valor?.versoes ?? [])].reverse());

  constructor() {
    const assinatura = inject(ActivatedRoute).paramMap.subscribe((params) => {
      this.sku.set(params.get('sku') ?? '');
      this.limite = undefined;
      this.painel.set('ENTRADA');
      void this.carregar();
    });
    inject(DestroyRef).onDestroy(() => assinatura.unsubscribe());
  }

  protected async carregar(): Promise<void> {
    await Promise.all([this.estoque.carregar(), this.historico.carregar(), this.fornecedores.carregar(), this.reposicao.carregar()]);
  }

  /** Depois de uma gravação confirmada, relê o que mudou sem apagar a tela. */
  protected atualizar(): void {
    void this.estoque.carregar(true);
    void this.historico.carregar(true);
    void this.reposicao.carregar(true);
  }

  protected verTudo(): void {
    this.limite = this.estoque.valor?.totalMovimentos;
    void this.estoque.carregar(true);
  }

  /** Descreve o que mudou em relação à versão anterior. Apenas apresentação. */
  protected resumoVersao(v: VersaoProduto): string {
    const versoes = this.historico.valor?.versoes ?? [];
    const indice = versoes.findIndex((x) => x.operacaoId === v.operacaoId);
    const anterior = indice > 0 ? versoes[indice - 1] : undefined;
    if (!anterior) return 'Cadastro inicial.';
    const mudancas = Object.keys(ROTULOS_CAMPOS)
      .filter((campo) => (anterior.produto as unknown as Record<string, unknown>)[campo] !== (v.produto as unknown as Record<string, unknown>)[campo])
      .map((campo) => `${ROTULOS_CAMPOS[campo]}: ${this.valorCampo(campo, (anterior.produto as unknown as Record<string, unknown>)[campo])} → ${this.valorCampo(campo, (v.produto as unknown as Record<string, unknown>)[campo])}`);
    return mudancas.length ? mudancas.join('; ') + '.' : 'Sem mudança visível.';
  }

  private valorCampo(campo: string, valor: unknown): string {
    if (campo === 'ativo') return valor ? 'ativo' : 'inativo';
    if (campo.endsWith('_centavos') && typeof valor === 'number') return formatarBRL(valor);
    return valor === null || valor === undefined ? 'nenhum' : String(valor);
  }
}
