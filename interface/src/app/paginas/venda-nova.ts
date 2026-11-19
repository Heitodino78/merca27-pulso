import { Component, ElementRef, Injector, afterNextRender, computed, effect, inject, signal, untracked, viewChild } from '@angular/core';
import { FormArray, FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { focarPrimeiroInvalido, formatoInteiro, mensagemErro, obrigatorio, textoOpcional } from '../formularios/validacao';
import { FORMAS_PAGAMENTO, type ListaProdutos, type PedidoVenda, type RespostaVenda } from '../nucleo/contratos';
import { paraInteiro } from '../nucleo/dinheiro';
import { PulsoApi } from '../nucleo/pulso-api';
import { RegistroEnvios } from '../nucleo/registro-envios';
import { AvisoEnvio } from '../ui/aviso-envio';
import { Campo, descricao } from '../ui/campo';
import { Carga, Carregando, FalhaConsulta, Vazio } from '../ui/carga';
import { BrlPipe, RotuloCategoriaPipe } from '../ui/formatos';

type DadosVenda = Omit<PedidoVenda, 'requisicaoId'>;

const novoItem = () => new FormGroup({
  sku: new FormControl('', { nonNullable: true, validators: [obrigatorio] }),
  quantidade: new FormControl('1', { nonNullable: true, validators: [obrigatorio, formatoInteiro] }),
});

/**
 * Venda com vários itens. O total mostrado na revisão usa os preços listados e serve só
 * para conferência: o valor oficial é calculado e gravado pelo núcleo, com o cadastro
 * vigente dentro da trava, e aparece na confirmação.
 */
@Component({
  selector: 'pulso-venda-nova',
  imports: [ReactiveFormsModule, RouterLink, AvisoEnvio, Campo, Carregando, FalhaConsulta, Vazio, BrlPipe, RotuloCategoriaPipe],
  template: `
    <nav aria-label="Trilha" class="mb-3 text-sm"><a routerLink="/vendas" class="text-verde-escuro underline">Vendas</a> / Nova</nav>
    <h1 tabindex="-1" class="text-2xl font-extrabold tracking-tight sm:text-3xl">Registrar venda</h1>
    <p class="mt-1 max-w-2xl text-sm text-suave">
      Tudo ou nada: se um item não tiver saldo, nenhum é vendido. Sem descontos. A forma de pagamento é só informativa.
    </p>

    @if (produtos.estado().fase === 'carregando') {
      <div class="mt-6"><pulso-carregando texto="Carregando produtos…" /></div>
    } @else if (produtos.estado().fase === 'falha') {
      @if (produtos.estado(); as e) { @if (e.fase === 'falha') { <div class="mt-6"><pulso-falha-consulta [erro]="e.erro" (tentarDeNovo)="produtos.carregar()" /></div> } }
    } @else if (ativos().length === 0) {
      <div class="mt-6"><pulso-vazio titulo="Nenhum produto ativo para vender" texto="Cadastre ou reative um produto." /></div>
    } @else {
      <form #formulario [formGroup]="form" (ngSubmit)="revisar()" novalidate class="cartao mt-6 max-w-3xl space-y-5">
        <fieldset [disabled]="revisando() || controle.enviando() || !!confirmada()" class="space-y-4">
          <legend class="text-lg font-bold">Itens</legend>
          <div>
            <label for="busca-produto-venda" class="rotulo">Buscar produto por nome ou SKU</label>
            <input id="busca-produto-venda" type="search" class="campo-entrada" [value]="busca()" (input)="busca.set($any($event.target).value)" />
          </div>
          <ol formArrayName="itens" class="space-y-3">
            @for (grupo of itens.controls; track grupo; let i = $index) {
              <li [formGroupName]="i" class="grid gap-3 rounded-md border border-borda p-3 sm:grid-cols-[1fr_8rem_auto] sm:items-end">
                <pulso-campo [id]="'item-' + i + '-sku'" [rotulo]="'Produto do item ' + (i + 1)" [erro]="erroItem(i, 'sku')">
                  <select [id]="'item-' + i + '-sku'" formControlName="sku" class="campo-entrada"
                          [attr.aria-invalid]="erroItem(i, 'sku') ? true : null" [attr.aria-describedby]="descItem(i, 'sku')">
                    <option value="">Selecione o produto</option>
                    @for (p of opcoesItem(i); track p.sku) {
                      <option [value]="p.sku">{{ p.sku }} — {{ p.nome }} ({{ p.precoVendaCentavos | brl }}, saldo {{ p.saldoAtual }})</option>
                    }
                  </select>
                </pulso-campo>
                <pulso-campo [id]="'item-' + i + '-quantidade'" rotulo="Quantidade" [erro]="erroItem(i, 'quantidade')">
                  <input [id]="'item-' + i + '-quantidade'" formControlName="quantidade" inputmode="numeric" autocomplete="off" class="campo-entrada"
                         [attr.aria-invalid]="erroItem(i, 'quantidade') ? true : null" [attr.aria-describedby]="descItem(i, 'quantidade')" />
                </pulso-campo>
                <button type="button" class="botao-secundario" [disabled]="itens.length === 1" (click)="removerItem(i)"
                        [attr.aria-label]="'Remover item ' + (i + 1)">Remover</button>
              </li>
            }
          </ol>
          <button type="button" class="botao-secundario" [disabled]="itens.length >= 50" (click)="adicionarItem()">Adicionar item</button>

          <div class="grid gap-4 sm:grid-cols-2">
            <pulso-campo id="venda-pagamento" rotulo="Forma de pagamento (informativa)" [erro]="erro('pagamento')">
              <select id="venda-pagamento" formControlName="pagamento" class="campo-entrada"
                      [attr.aria-invalid]="erro('pagamento') ? true : null" [attr.aria-describedby]="descricao('venda-pagamento', false, !!erro('pagamento'))">
                <option value="">Selecione</option>
                @for (f of formas; track f) { <option [value]="f">{{ f | rotuloCategoria }}</option> }
              </select>
            </pulso-campo>
            <pulso-campo id="venda-observacao" rotulo="Observação" [opcional]="true" dica="Sem dados pessoais.">
              <input id="venda-observacao" formControlName="observacao" autocomplete="off" class="campo-entrada" aria-describedby="venda-observacao-dica" />
            </pulso-campo>
          </div>
        </fieldset>

        @if (!revisando() && !confirmada()) {
          <button type="submit" class="botao-principal">Revisar venda</button>
        } @else if (revisando() && !confirmada()) {
          <section aria-labelledby="titulo-revisao" class="overflow-x-auto rounded-md border border-verde bg-destaque p-4">
            <h2 id="titulo-revisao" tabindex="-1" #revisao class="font-bold text-verde-escuro outline-none">Revise antes de confirmar</h2>
            <table class="mt-3 w-full text-left text-sm">
              <caption class="sr-only">Itens da venda</caption>
              <thead><tr class="text-xs uppercase text-suave"><th scope="col" class="py-1">Produto</th><th scope="col" class="py-1 text-right">Qtd.</th><th scope="col" class="py-1 text-right">Preço atual</th><th scope="col" class="py-1 text-right">Subtotal</th></tr></thead>
              <tbody>
                @for (linha of revisaoLinhas(); track $index) {
                  <tr class="border-t border-borda"><td class="py-1">{{ linha.sku }} — {{ linha.nome }}</td><td class="py-1 text-right tabular-nums">{{ linha.quantidade }}</td>
                    <td class="py-1 text-right tabular-nums">{{ linha.preco | brl }}</td><td class="py-1 text-right tabular-nums">{{ linha.subtotal | brl }}</td></tr>
                }
              </tbody>
            </table>
            <p class="mt-3 font-bold">Total para conferência: {{ totalRevisao() | brl }}</p>
            <p class="text-sm text-suave">O valor oficial é calculado pelo PULSO ao confirmar, com o preço vigente naquele momento.</p>
            <div class="mt-3 flex flex-wrap gap-3">
              <button type="button" class="botao-principal" [disabled]="controle.enviando()" (click)="confirmar()">
                {{ controle.enviando() ? 'Confirmando…' : 'Confirmar venda' }}
              </button>
              <button type="button" class="botao-secundario" [disabled]="controle.enviando()" (click)="editar()">Voltar e editar</button>
            </div>
          </section>
        }

        <pulso-aviso-envio [controle]="controle">
          @if (confirmada(); as v) {
            <p sucesso class="mt-1">
              Total oficial <strong>{{ v.totalCentavos | brl }}</strong> ({{ v.formaPagamento | rotuloCategoria }}).
              <a [routerLink]="['/vendas', v.vendaId]" class="font-semibold text-verde-escuro underline">Ver venda {{ v.vendaId }}</a>
            </p>
          }
        </pulso-aviso-envio>
        @if (confirmada()) {
          <button type="button" class="botao-secundario" (click)="novaVenda()">Nova venda</button>
        }
      </form>
    }
  `,
})
export class VendaNovaPagina {
  private readonly api = inject(PulsoApi);
  private readonly injector = inject(Injector);
  protected readonly formas = FORMAS_PAGAMENTO;
  protected readonly descricao = descricao;
  protected readonly produtos = new Carga<ListaProdutos>(() => this.api.listarProdutos());
  protected readonly ativos = computed(() => (this.produtos.valor?.produtos ?? []).filter((p) => p.ativo));

  protected readonly form = new FormGroup({
    itens: new FormArray([novoItem()]),
    pagamento: new FormControl('', { nonNullable: true, validators: [obrigatorio] }),
    observacao: new FormControl('', { nonNullable: true }),
  });
  protected get itens(): FormArray<ReturnType<typeof novoItem>> { return this.form.controls.itens; }

  protected readonly tentou = signal(false);
  protected readonly revisando = signal(false);
  protected readonly busca = signal('');
  protected readonly confirmada = computed(() => {
    const e = this.controle.estado();
    return e.fase === 'sucesso' ? e.resposta : null;
  });
  private readonly dadosRevisados = signal<DadosVenda | null>(null);
  private readonly formulario = viewChild<ElementRef<HTMLFormElement>>('formulario');
  private readonly revisaoTitulo = viewChild<ElementRef<HTMLElement>>('revisao');

  private readonly apiVenda = this.api;
  readonly controle = inject(RegistroEnvios).obter<DadosVenda, RespostaVenda>('venda-nova', (p: PedidoVenda) => this.apiVenda.confirmarVenda(p));

  protected readonly revisaoLinhas = computed(() => {
    const dados = this.dadosRevisados();
    const precos = new Map((this.produtos.valor?.produtos ?? []).map((p) => [p.sku, p]));
    return (dados?.itens ?? []).map((i) => {
      const p = precos.get(i.sku);
      const preco = p?.precoVendaCentavos ?? 0;
      return { sku: i.sku, nome: p?.nome ?? '', quantidade: i.quantidade, preco, subtotal: preco * i.quantidade };
    });
  });
  protected readonly totalRevisao = computed(() => this.revisaoLinhas().reduce((s, l) => s + l.subtotal, 0));

  constructor() {
    void this.produtos.carregar();
    effect(() => {
      if (this.confirmada()) {
        this.revisando.set(false);
        untracked(() => { void this.produtos.carregar(true); });
      }
    });
  }

  protected opcoesItem(i: number) {
    const termo = this.busca().trim().toLocaleLowerCase('pt-BR');
    const escolhido = this.itens.at(i).controls.sku.value;
    return this.ativos().filter((p) => p.sku === escolhido || !termo || `${p.sku} ${p.nome}`.toLocaleLowerCase('pt-BR').includes(termo));
  }

  protected erro(nome: 'pagamento'): string | null {
    return mensagemErro(this.form.controls[nome], this.tentou());
  }
  protected erroItem(i: number, campo: 'sku' | 'quantidade'): string | null {
    const grupo = this.itens.at(i);
    return grupo ? mensagemErro(grupo.controls[campo], this.tentou()) : null;
  }
  protected descItem(i: number, campo: 'sku' | 'quantidade'): string | null {
    return descricao(`item-${i}-${campo}`, false, !!this.erroItem(i, campo));
  }

  protected adicionarItem(): void {
    this.itens.push(novoItem());
    const indice = this.itens.length - 1;
    afterNextRender(() => document.getElementById(`item-${indice}-sku`)?.focus(), { injector: this.injector });
  }
  protected removerItem(i: number): void {
    if (this.itens.length > 1) this.itens.removeAt(i);
  }

  protected revisar(): void {
    if (this.controle.enviando() || this.confirmada()) return;
    this.tentou.set(true);
    if (this.form.invalid) {
      afterNextRender(() => { const f = this.formulario(); if (f) focarPrimeiroInvalido(f.nativeElement); }, { injector: this.injector });
      return;
    }
    const v = this.form.getRawValue();
    const observacao = textoOpcional(v.observacao);
    this.dadosRevisados.set({
      itens: v.itens.map((i) => ({ sku: i.sku, quantidade: paraInteiro(i.quantidade) ?? Number.NaN })),
      formaPagamentoFicticia: v.pagamento,
      ...(observacao ? { observacao } : {}),
    });
    this.revisando.set(true);
    afterNextRender(() => this.revisaoTitulo()?.nativeElement.focus(), { injector: this.injector });
  }

  protected editar(): void {
    this.revisando.set(false);
  }

  protected async confirmar(): Promise<void> {
    const dados = this.dadosRevisados();
    if (!dados || this.controle.enviando() || this.confirmada()) return;
    const ok = await this.controle.enviar(dados);
    const estado = this.controle.estado();
    if (!ok && estado.fase !== 'sucesso') {
      // Recusa ou falha: volta à edição; a chave segue as regras do ControleEnvio.
      this.revisando.set(false);
    }
  }

  protected novaVenda(): void {
    this.controle.novaTentativa();
    this.busca.set('');
    this.revisando.set(false);
    this.tentou.set(false);
    this.form.setControl('itens', new FormArray([novoItem()]));
    this.form.patchValue({ pagamento: '', observacao: '' });
    afterNextRender(() => document.getElementById('item-0-sku')?.focus(), { injector: this.injector });
  }
}
