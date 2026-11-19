import { Component, ElementRef, Injector, afterNextRender, computed, inject, signal, viewChild } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { CATEGORIAS, type ListaFornecedores, type PedidoCadastro, type RespostaGravacao } from '../nucleo/contratos';
import { formatarBRL, paraCentavos, paraInteiro } from '../nucleo/dinheiro';
import { PulsoApi } from '../nucleo/pulso-api';
import { RegistroEnvios } from '../nucleo/registro-envios';
import { focarPrimeiroInvalido, formatoDinheiro, formatoInteiro, mensagemErro, obrigatorio } from '../formularios/validacao';
import { AvisoEnvio } from '../ui/aviso-envio';
import { Campo, descricao } from '../ui/campo';
import { Carga } from '../ui/carga';
import { RotuloCategoriaPipe } from '../ui/formatos';

@Component({
  selector: 'pulso-produto-novo',
  imports: [ReactiveFormsModule, RouterLink, Campo, AvisoEnvio, RotuloCategoriaPipe],
  template: `
    <nav aria-label="Trilha" class="mb-3 text-sm"><a routerLink="/produtos" class="text-verde-escuro underline">Produtos</a> / Novo</nav>
    <h1 tabindex="-1" class="text-2xl font-extrabold tracking-tight sm:text-3xl">Cadastrar produto</h1>
    <p class="mt-1 max-w-2xl text-sm text-suave">
      Valores em reais são convertidos para centavos inteiros antes do envio. As regras do cadastro
      (formato do SKU, alvo maior ou igual ao mínimo, fornecedor existente) são verificadas pelo PULSO.
    </p>

    <form #formulario [formGroup]="form" (ngSubmit)="enviar()" novalidate class="cartao mt-6 max-w-3xl space-y-5">
      <fieldset [disabled]="controle.enviando()" class="grid gap-4 sm:grid-cols-2">
        <legend class="sr-only">Dados do produto</legend>
        <pulso-campo id="cad-sku" rotulo="SKU" [erro]="erro('sku')" dica="Formato MER-001. Não pode ser alterado depois.">
          <input id="cad-sku" formControlName="sku" autocomplete="off" class="campo-entrada font-mono uppercase" placeholder="MER-041"
                 [attr.aria-invalid]="erro('sku') ? true : null" [attr.aria-describedby]="desc('sku', true)" />
        </pulso-campo>
        <pulso-campo id="cad-categoria" rotulo="Categoria" [erro]="erro('categoria')">
          <select id="cad-categoria" formControlName="categoria" class="campo-entrada"
                  [attr.aria-invalid]="erro('categoria') ? true : null" [attr.aria-describedby]="desc('categoria', false)">
            <option value="">Selecione a categoria</option>
            @for (c of categorias; track c) { <option [value]="c">{{ c | rotuloCategoria }}</option> }
          </select>
        </pulso-campo>
        <pulso-campo class="sm:col-span-2" id="cad-nome" rotulo="Nome" [erro]="erro('nome')" dica="Use apenas nomes fictícios.">
          <input id="cad-nome" formControlName="nome" autocomplete="off" class="campo-entrada"
                 [attr.aria-invalid]="erro('nome') ? true : null" [attr.aria-describedby]="desc('nome', true)" />
        </pulso-campo>
        <pulso-campo id="cad-preco" rotulo="Preço de venda (R$)" [erro]="erro('preco')" [dica]="previa('preco')">
          <input id="cad-preco" formControlName="preco" inputmode="decimal" autocomplete="off" placeholder="0,00" class="campo-entrada"
                 [attr.aria-invalid]="erro('preco') ? true : null" [attr.aria-describedby]="desc('preco', !!previa('preco'))" />
        </pulso-campo>
        <pulso-campo id="cad-custo" rotulo="Custo de referência (R$)" [erro]="erro('custo')" [dica]="previa('custo')">
          <input id="cad-custo" formControlName="custo" inputmode="decimal" autocomplete="off" placeholder="0,00" class="campo-entrada"
                 [attr.aria-invalid]="erro('custo') ? true : null" [attr.aria-describedby]="desc('custo', !!previa('custo'))" />
        </pulso-campo>
        <pulso-campo id="cad-minimo" rotulo="Estoque mínimo" [erro]="erro('minimo')">
          <input id="cad-minimo" formControlName="minimo" inputmode="numeric" autocomplete="off" class="campo-entrada"
                 [attr.aria-invalid]="erro('minimo') ? true : null" [attr.aria-describedby]="desc('minimo', false)" />
        </pulso-campo>
        <pulso-campo id="cad-alvo" rotulo="Estoque alvo" [erro]="erro('alvo')">
          <input id="cad-alvo" formControlName="alvo" inputmode="numeric" autocomplete="off" class="campo-entrada"
                 [attr.aria-invalid]="erro('alvo') ? true : null" [attr.aria-describedby]="desc('alvo', false)" />
        </pulso-campo>
        <pulso-campo class="sm:col-span-2" id="cad-fornecedor" rotulo="Fornecedor principal" [opcional]="true"
                     [dica]="fornecedores.estado().fase === 'falha' ? 'Não foi possível carregar os fornecedores; o produto pode ser cadastrado sem fornecedor.' : null">
          <select id="cad-fornecedor" formControlName="fornecedorId" class="campo-entrada">
            <option value="">Sem fornecedor</option>
            @for (f of listaFornecedores(); track f.fornecedor_id) {
              <option [value]="f.fornecedor_id">{{ f.fornecedor_id }} — {{ f.nome_ficticio }}</option>
            }
          </select>
        </pulso-campo>
      </fieldset>

      <div class="flex flex-wrap gap-3">
        <button type="submit" class="botao-principal" [disabled]="controle.enviando()">
          {{ controle.enviando() ? 'Cadastrando…' : 'Cadastrar produto' }}
        </button>
        @if (cadastrado(); as sku) {
          <button type="button" class="botao-secundario" (click)="novoCadastro()">Cadastrar outro</button>
        }
      </div>

      <pulso-aviso-envio [controle]="controle">
        @if (cadastrado(); as sku) {
          <p sucesso class="mt-1">
            <a [routerLink]="['/produtos', sku]" class="font-semibold text-verde-escuro underline">Abrir {{ sku }}</a>
            para registrar saldo inicial ou entrada.
          </p>
        }
      </pulso-aviso-envio>
    </form>
  `,
})
export class ProdutoNovoPagina {
  private readonly api = inject(PulsoApi);
  private readonly injector = inject(Injector);
  protected readonly categorias = CATEGORIAS;
  protected readonly fornecedores = new Carga<ListaFornecedores>(() => this.api.listarFornecedores());
  protected readonly listaFornecedores = computed(() => (this.fornecedores.valor?.fornecedores ?? []).filter((f) => f.ativo));

  protected readonly form = new FormGroup({
    sku: new FormControl('', { nonNullable: true, validators: [obrigatorio] }),
    nome: new FormControl('', { nonNullable: true, validators: [obrigatorio] }),
    categoria: new FormControl('', { nonNullable: true, validators: [obrigatorio] }),
    preco: new FormControl('', { nonNullable: true, validators: [obrigatorio, formatoDinheiro] }),
    custo: new FormControl('', { nonNullable: true, validators: [obrigatorio, formatoDinheiro] }),
    minimo: new FormControl('', { nonNullable: true, validators: [obrigatorio, formatoInteiro] }),
    alvo: new FormControl('', { nonNullable: true, validators: [obrigatorio, formatoInteiro] }),
    fornecedorId: new FormControl('', { nonNullable: true }),
  });
  protected readonly tentou = signal(false);
  protected readonly cadastrado = signal<string | null>(null);
  private readonly valores = signal(this.form.getRawValue());
  private readonly formulario = viewChild.required<ElementRef<HTMLFormElement>>('formulario');
  private readonly apiCadastro = this.api;
  readonly controle = inject(RegistroEnvios).obter<Omit<PedidoCadastro, 'requisicaoId'>, RespostaGravacao>(
    'cadastro-produto', (p: PedidoCadastro) => this.apiCadastro.cadastrarProduto(p));

  constructor() {
    void this.fornecedores.carregar();
    this.form.valueChanges.subscribe(() => this.valores.set(this.form.getRawValue()));
  }

  protected previa(nome: 'preco' | 'custo'): string | null {
    const centavos = paraCentavos(this.valores()[nome]);
    return centavos === null ? null : `Será registrado como ${formatarBRL(centavos)}.`;
  }

  protected erro(nome: keyof typeof this.form.controls): string | null {
    return mensagemErro(this.form.controls[nome], this.tentou());
  }

  protected desc(nome: keyof typeof this.form.controls, temDica: boolean): string | null {
    return descricao(`cad-${nome}`, temDica, !!this.erro(nome));
  }

  async enviar(): Promise<void> {
    if (this.controle.enviando()) return;
    this.tentou.set(true);
    if (this.form.invalid) {
      afterNextRender(() => focarPrimeiroInvalido(this.formulario().nativeElement), { injector: this.injector });
      return;
    }
    const v = this.form.getRawValue();
    const ok = await this.controle.enviar({
      sku: v.sku.trim().toUpperCase(),
      nome: v.nome.trim(),
      categoria: v.categoria,
      precoVendaCentavos: paraCentavos(v.preco) ?? Number.NaN,
      custoRefCentavos: paraCentavos(v.custo) ?? Number.NaN,
      estoqueMinimo: paraInteiro(v.minimo) ?? Number.NaN,
      estoqueAlvo: paraInteiro(v.alvo) ?? Number.NaN,
      fornecedorId: v.fornecedorId || null,
    });
    const estado = this.controle.estado();
    if (ok && estado.fase === 'sucesso') this.cadastrado.set(estado.resposta.sku ?? null);
  }

  protected novoCadastro(): void {
    this.controle.novaTentativa();
    this.cadastrado.set(null);
    this.tentou.set(false);
    this.form.reset();
    afterNextRender(() => document.getElementById('cad-sku')?.focus(), { injector: this.injector });
  }
}
