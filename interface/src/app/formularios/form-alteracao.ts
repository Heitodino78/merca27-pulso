import { Component, ElementRef, Injector, afterNextRender, effect, inject, input, output, signal, untracked, viewChild, type OnInit } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { CATEGORIAS, type ConsultaEstoque, type LinhaFornecedor, type PedidoAlteracao, type RespostaGravacao } from '../nucleo/contratos';
import { centavosParaCampo, paraCentavos, paraInteiro } from '../nucleo/dinheiro';
import type { ControleEnvio } from '../nucleo/envio';
import { PulsoApi } from '../nucleo/pulso-api';
import { RegistroEnvios } from '../nucleo/registro-envios';
import { AvisoEnvio } from '../ui/aviso-envio';
import { Campo, descricao } from '../ui/campo';
import { RotuloCategoriaPipe } from '../ui/formatos';
import { focarPrimeiroInvalido, formatoDinheiro, formatoInteiro, mensagemErro, obrigatorio } from './validacao';

let contador = 0;

interface DadosStatus {
  sku: string;
  motivo: string;
  acao: 'desativar' | 'reativar';
}

/** Alteração auditável do cadastro. SKU e unidade são imutáveis e nem aparecem aqui. */
@Component({
  selector: 'pulso-form-alteracao',
  imports: [ReactiveFormsModule, Campo, AvisoEnvio, RotuloCategoriaPipe],
  template: `
    <form #formulario [formGroup]="form" (ngSubmit)="enviar()" novalidate class="space-y-4">
      <fieldset [disabled]="controle.enviando()" class="grid gap-4 sm:grid-cols-2">
        <pulso-campo class="sm:col-span-2" [id]="id + '-nome'" rotulo="Nome" [erro]="erro('nome')">
          <input [id]="id + '-nome'" formControlName="nome" autocomplete="off" class="campo-entrada"
                 [attr.aria-invalid]="erro('nome') ? true : null" [attr.aria-describedby]="desc('nome', false)" />
        </pulso-campo>
        <pulso-campo [id]="id + '-categoria'" rotulo="Categoria" [erro]="erro('categoria')">
          <select [id]="id + '-categoria'" formControlName="categoria" class="campo-entrada"
                  [attr.aria-invalid]="erro('categoria') ? true : null" [attr.aria-describedby]="desc('categoria', false)">
            @for (c of categorias; track c) { <option [value]="c">{{ c | rotuloCategoria }}</option> }
          </select>
        </pulso-campo>
        <pulso-campo [id]="id + '-fornecedor'" rotulo="Fornecedor principal" [opcional]="true">
          <select [id]="id + '-fornecedor'" formControlName="fornecedorId" class="campo-entrada">
            <option value="">Sem fornecedor</option>
            @for (f of fornecedores(); track f.fornecedor_id) {
              <option [value]="f.fornecedor_id">{{ f.fornecedor_id }} — {{ f.nome_ficticio }}</option>
            }
          </select>
        </pulso-campo>
        <pulso-campo [id]="id + '-preco'" rotulo="Preço de venda (R$)" [erro]="erro('preco')">
          <input [id]="id + '-preco'" formControlName="preco" inputmode="decimal" autocomplete="off" class="campo-entrada"
                 [attr.aria-invalid]="erro('preco') ? true : null" [attr.aria-describedby]="desc('preco', false)" />
        </pulso-campo>
        <pulso-campo [id]="id + '-custo'" rotulo="Custo de referência (R$)" [erro]="erro('custo')">
          <input [id]="id + '-custo'" formControlName="custo" inputmode="decimal" autocomplete="off" class="campo-entrada"
                 [attr.aria-invalid]="erro('custo') ? true : null" [attr.aria-describedby]="desc('custo', false)" />
        </pulso-campo>
        <pulso-campo [id]="id + '-minimo'" rotulo="Estoque mínimo" [erro]="erro('minimo')">
          <input [id]="id + '-minimo'" formControlName="minimo" inputmode="numeric" autocomplete="off" class="campo-entrada"
                 [attr.aria-invalid]="erro('minimo') ? true : null" [attr.aria-describedby]="desc('minimo', false)" />
        </pulso-campo>
        <pulso-campo [id]="id + '-alvo'" rotulo="Estoque alvo" [erro]="erro('alvo')">
          <input [id]="id + '-alvo'" formControlName="alvo" inputmode="numeric" autocomplete="off" class="campo-entrada"
                 [attr.aria-invalid]="erro('alvo') ? true : null" [attr.aria-describedby]="desc('alvo', false)" />
        </pulso-campo>
        <pulso-campo class="sm:col-span-2" [id]="id + '-motivo'" rotulo="Motivo da alteração" [erro]="erro('motivo')" dica="Fica registrado no histórico de versões.">
          <input [id]="id + '-motivo'" formControlName="motivo" autocomplete="off" class="campo-entrada"
                 [attr.aria-invalid]="erro('motivo') ? true : null" [attr.aria-describedby]="desc('motivo', true)" />
        </pulso-campo>
      </fieldset>
      <div class="flex flex-wrap gap-3">
        <button type="submit" class="botao-principal" [disabled]="controle.enviando()">
          {{ controle.enviando() ? 'Salvando…' : 'Salvar alteração' }}
        </button>
        <button type="button" class="botao-secundario" [disabled]="controle.enviando()" (click)="restaurar()">Desfazer edição</button>
      </div>
      <pulso-aviso-envio [controle]="controle" />
    </form>
  `,
})
export class FormAlteracao implements OnInit {
  private readonly api = inject(PulsoApi);
  private readonly registro = inject(RegistroEnvios);
  private readonly injector = inject(Injector);
  protected readonly id = `alteracao-${++contador}`;
  protected readonly categorias = CATEGORIAS;

  readonly produto = input.required<ConsultaEstoque>();
  readonly fornecedores = input<LinhaFornecedor[]>([]);
  readonly alterado = output<RespostaGravacao>();

  protected readonly form = new FormGroup({
    nome: new FormControl('', { nonNullable: true, validators: [obrigatorio] }),
    categoria: new FormControl('', { nonNullable: true, validators: [obrigatorio] }),
    fornecedorId: new FormControl('', { nonNullable: true }),
    preco: new FormControl('', { nonNullable: true, validators: [obrigatorio, formatoDinheiro] }),
    custo: new FormControl('', { nonNullable: true, validators: [obrigatorio, formatoDinheiro] }),
    minimo: new FormControl('', { nonNullable: true, validators: [obrigatorio, formatoInteiro] }),
    alvo: new FormControl('', { nonNullable: true, validators: [obrigatorio, formatoInteiro] }),
    motivo: new FormControl('', { nonNullable: true, validators: [obrigatorio] }),
  });
  protected readonly tentou = signal(false);
  private readonly formulario = viewChild.required<ElementRef<HTMLFormElement>>('formulario');
  controle!: ControleEnvio<Omit<PedidoAlteracao, 'requisicaoId'>, RespostaGravacao>;

  constructor() {
    // Recarrega os valores quando chega uma nova versão do cadastro.
    effect(() => {
      this.produto().atualizadoEm;
      untracked(() => this.restaurar());
    });
  }

  ngOnInit(): void {
    const api = this.api;
    this.controle = this.registro.obter<Omit<PedidoAlteracao, 'requisicaoId'>, RespostaGravacao>(`alteracao:${this.produto().sku}`, (p: PedidoAlteracao) => api.alterarProduto(p));
  }

  protected restaurar(): void {
    const p = this.produto();
    this.form.reset({
      nome: p.nome, categoria: p.categoria, fornecedorId: p.fornecedorId ?? '',
      preco: centavosParaCampo(p.precoVendaCentavos), custo: centavosParaCampo(p.custoRefCentavos),
      minimo: String(p.estoqueMinimo), alvo: String(p.estoqueAlvo), motivo: '',
    });
    this.tentou.set(false);
  }

  protected erro(nome: keyof typeof this.form.controls): string | null {
    return mensagemErro(this.form.controls[nome], this.tentou());
  }

  protected desc(nome: keyof typeof this.form.controls, temDica: boolean): string | null {
    return descricao(`${this.id}-${nome}`, temDica, !!this.erro(nome));
  }

  async enviar(): Promise<void> {
    if (this.controle.enviando()) return;
    this.tentou.set(true);
    if (this.form.invalid) {
      afterNextRender(() => focarPrimeiroInvalido(this.formulario().nativeElement), { injector: this.injector });
      return;
    }
    const v = this.form.getRawValue();
    // Todos os campos alteráveis vão no pedido; o núcleo calcula o que mudou de fato
    // e recusa com ALTERACAO_SEM_MUDANCA se nada mudou.
    const ok = await this.controle.enviar({
      sku: this.produto().sku,
      motivo: v.motivo.trim(),
      campos: {
        nome: v.nome.trim(),
        categoria: v.categoria,
        fornecedorId: v.fornecedorId || null,
        precoVendaCentavos: paraCentavos(v.preco) ?? Number.NaN,
        custoRefCentavos: paraCentavos(v.custo) ?? Number.NaN,
        estoqueMinimo: paraInteiro(v.minimo) ?? Number.NaN,
        estoqueAlvo: paraInteiro(v.alvo) ?? Number.NaN,
      },
    });
    const estado = this.controle.estado();
    if (ok && estado.fase === 'sucesso') this.alterado.emit(estado.resposta);
  }
}

/** Desativação ou reativação, sempre com motivo. */
@Component({
  selector: 'pulso-form-status',
  imports: [ReactiveFormsModule, Campo, AvisoEnvio],
  template: `
    <form #formulario [formGroup]="form" (ngSubmit)="enviar()" novalidate class="space-y-3">
      <p class="text-sm text-texto">
        @if (ativo()) {
          Produto desativado não aceita novas entradas. Perdas e ajustes continuam possíveis, e o histórico é preservado.
        } @else {
          Reativar volta a aceitar entradas. O histórico continua o mesmo.
        }
      </p>
      <fieldset [disabled]="controle.enviando()">
        <pulso-campo [id]="id + '-motivo'" rotulo="Motivo" [erro]="erroMotivo()">
          <input [id]="id + '-motivo'" formControlName="motivo" autocomplete="off" class="campo-entrada"
                 [attr.aria-invalid]="erroMotivo() ? true : null" [attr.aria-describedby]="erroMotivo() ? id + '-motivo-erro' : null" />
        </pulso-campo>
      </fieldset>
      <button type="submit" [class]="ativo() ? 'botao-secundario' : 'botao-principal'" [disabled]="controle.enviando()">
        @if (controle.enviando()) { Salvando… } @else { {{ ativo() ? 'Desativar produto' : 'Reativar produto' }} }
      </button>
      <pulso-aviso-envio [controle]="controle" />
    </form>
  `,
})
export class FormStatus implements OnInit {
  private readonly api = inject(PulsoApi);
  private readonly registro = inject(RegistroEnvios);
  private readonly injector = inject(Injector);
  protected readonly id = `status-${++contador}`;

  readonly sku = input.required<string>();
  readonly ativo = input.required<boolean>();
  readonly alterado = output<RespostaGravacao>();

  protected readonly form = new FormGroup({
    motivo: new FormControl('', { nonNullable: true, validators: [obrigatorio] }),
  });
  protected readonly tentou = signal(false);
  private readonly formulario = viewChild.required<ElementRef<HTMLFormElement>>('formulario');

  // A ação (desativar ou reativar) faz parte dos dados: trocar de ação com a mesma chave
  // seria um pedido diferente, que o núcleo trataria como conflito.
  controle!: ControleEnvio<DadosStatus, RespostaGravacao>;

  constructor() {
    // Ao mudar o status confirmado, a próxima ação é outra tentativa lógica.
    effect(() => {
      this.ativo();
      untracked(() => {
        if (this.controle.estado().fase === 'sucesso' || this.controle.estado().fase === 'ocioso') {
          this.form.reset({ motivo: '' });
          this.tentou.set(false);
        }
      });
    });
  }

  ngOnInit(): void {
    const api = this.api;
    this.controle = this.registro.obter(`status:${this.sku()}`, ({ acao, ...pedido }: DadosStatus & { requisicaoId: string }) =>
      acao === 'desativar' ? api.desativarProduto(pedido) : api.reativarProduto(pedido));
  }

  protected erroMotivo(): string | null {
    return mensagemErro(this.form.controls.motivo, this.tentou());
  }

  async enviar(): Promise<void> {
    if (this.controle.enviando()) return;
    this.tentou.set(true);
    if (this.form.invalid) {
      afterNextRender(() => focarPrimeiroInvalido(this.formulario().nativeElement), { injector: this.injector });
      return;
    }
    const ok = await this.controle.enviar({
      sku: this.sku(), motivo: this.form.getRawValue().motivo.trim(), acao: this.ativo() ? 'desativar' : 'reativar',
    });
    const estado = this.controle.estado();
    if (ok && estado.fase === 'sucesso') this.alterado.emit(estado.resposta);
  }
}
