import { Component, ElementRef, Injector, afterNextRender, computed, effect, inject, input, output, signal, viewChild, type OnInit } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import type { LinhaFornecedor, PedidoEntrada, ProdutoResumo, RespostaGravacao } from '../nucleo/contratos';
import { formatarBRL, paraCentavos, paraInteiro } from '../nucleo/dinheiro';
import type { ControleEnvio } from '../nucleo/envio';
import { PulsoApi } from '../nucleo/pulso-api';
import { RegistroEnvios } from '../nucleo/registro-envios';
import { AvisoEnvio } from '../ui/aviso-envio';
import { Campo, descricao } from '../ui/campo';
import { focarPrimeiroInvalido, formatoDinheiro, formatoInteiro, mensagemErro, obrigatorio, textoOpcional } from './validacao';

let contador = 0;

@Component({
  selector: 'pulso-form-entrada',
  imports: [ReactiveFormsModule, RouterLink, Campo, AvisoEnvio],
  template: `
    <form #formulario [formGroup]="form" (ngSubmit)="enviar()" novalidate class="space-y-4">
      <fieldset [disabled]="controle.enviando()" class="grid gap-4 sm:grid-cols-2">
        @if (!skuFixo()) {
          <pulso-campo class="sm:col-span-2" [id]="id + '-sku'" rotulo="Produto" [erro]="erro('sku')"
                       dica="Produtos inativos aparecem marcados; o PULSO recusa entrada neles.">
            <select [id]="id + '-sku'" formControlName="sku" class="campo-entrada"
                    [attr.aria-invalid]="erro('sku') ? true : null" [attr.aria-describedby]="desc('sku', true)">
              <option value="">Selecione o produto</option>
              @for (p of produtos(); track p.sku) {
                <option [value]="p.sku">{{ p.sku }} — {{ p.nome }}{{ p.ativo ? '' : ' (inativo)' }}</option>
              }
            </select>
          </pulso-campo>
        }

        <pulso-campo class="sm:col-span-2" [id]="id + '-fornecedor'" rotulo="Fornecedor" [erro]="erro('fornecedorId')" [dica]="dicaFornecedor()">
          <select [id]="id + '-fornecedor'" formControlName="fornecedorId" class="campo-entrada"
                  [attr.aria-invalid]="erro('fornecedorId') ? true : null" [attr.aria-describedby]="desc('fornecedorId', !!dicaFornecedor())">
            <option value="">Selecione o fornecedor</option>
            @for (f of fornecedores(); track f.fornecedor_id) {
              <option [value]="f.fornecedor_id">{{ f.fornecedor_id }} — {{ f.nome_ficticio }}{{ f.ativo ? '' : ' (inativo)' }}</option>
            }
          </select>
        </pulso-campo>

        <pulso-campo [id]="id + '-quantidade'" rotulo="Quantidade (unidades)" [erro]="erro('quantidade')">
          <input [id]="id + '-quantidade'" formControlName="quantidade" inputmode="numeric" autocomplete="off" class="campo-entrada"
                 [attr.aria-invalid]="erro('quantidade') ? true : null" [attr.aria-describedby]="desc('quantidade', false)" />
        </pulso-campo>

        <pulso-campo [id]="id + '-custo'" rotulo="Custo unitário pago (R$)" [erro]="erro('custo')" [dica]="dicaCusto()">
          <input [id]="id + '-custo'" formControlName="custo" inputmode="decimal" autocomplete="off" placeholder="0,00" class="campo-entrada"
                 [attr.aria-invalid]="erro('custo') ? true : null" [attr.aria-describedby]="desc('custo', true)" />
        </pulso-campo>

        <pulso-campo [id]="id + '-referencia'" rotulo="Referência do fornecedor" [opcional]="true" dica="Por exemplo, número fictício da nota.">
          <input [id]="id + '-referencia'" formControlName="referencia" autocomplete="off" class="campo-entrada" [attr.aria-describedby]="desc('referencia', true)" />
        </pulso-campo>

        <pulso-campo [id]="id + '-motivo'" rotulo="Observação" [opcional]="true">
          <input [id]="id + '-motivo'" formControlName="motivo" autocomplete="off" class="campo-entrada" />
        </pulso-campo>
      </fieldset>

      <div class="flex flex-wrap items-center gap-3">
        <button type="submit" class="botao-principal" [disabled]="controle.enviando()">
          {{ controle.enviando() ? 'Registrando…' : 'Registrar entrada' }}
        </button>
        @if (controle.estado().fase === 'sucesso') {
          <button type="button" class="botao-secundario" (click)="novaEntrada()">Nova entrada</button>
        }
      </div>

      <pulso-aviso-envio [controle]="controle">
        @if (ultimo(); as r) {
          <p sucesso class="mt-1">
            {{ r.sku }}: {{ r.quantidade }} unidade(s). Saldo atual: <strong>{{ r.saldoAtual }}</strong>.
            @if (!skuFixo()) { <a [routerLink]="['/produtos', r.sku]" class="font-semibold text-verde-escuro underline">Ver histórico</a> }
          </p>
        }
      </pulso-aviso-envio>
    </form>
  `,
})
export class FormEntrada implements OnInit {
  private readonly api = inject(PulsoApi);
  private readonly registro = inject(RegistroEnvios);
  private readonly injector = inject(Injector);
  protected readonly id = `entrada-${++contador}`;

  readonly produtos = input<ProdutoResumo[]>([]);
  readonly fornecedores = input<LinhaFornecedor[]>([]);
  readonly skuFixo = input<string | null>(null);
  readonly skuInicial = input<string | null>(null);
  readonly custoReferencia = input<number | null>(null);
  readonly fornecedorDoCadastro = input<string | null>(null);
  readonly registrado = output<RespostaGravacao>();

  protected readonly form = new FormGroup({
    sku: new FormControl('', { nonNullable: true, validators: [obrigatorio] }),
    fornecedorId: new FormControl('', { nonNullable: true, validators: [obrigatorio] }),
    quantidade: new FormControl('', { nonNullable: true, validators: [obrigatorio, formatoInteiro] }),
    custo: new FormControl('', { nonNullable: true, validators: [obrigatorio, formatoDinheiro] }),
    referencia: new FormControl('', { nonNullable: true }),
    motivo: new FormControl('', { nonNullable: true }),
  });
  protected readonly tentou = signal(false);
  protected readonly ultimo = signal<RespostaGravacao | null>(null);
  controle!: ControleEnvio<Omit<PedidoEntrada, 'requisicaoId'>, RespostaGravacao>;
  private readonly formulario = viewChild.required<ElementRef<HTMLFormElement>>('formulario');
  private readonly custoDigitado = signal('');

  protected readonly dicaFornecedor = computed(() => {
    const f = this.fornecedorDoCadastro();
    return f ? `Fornecedor do cadastro: ${f}.` : null;
  });

  protected readonly dicaCusto = computed(() => {
    const valor = paraCentavos(this.custoDigitado());
    const ref = this.custoReferencia();
    const partes = [valor !== null ? `Será registrado como ${formatarBRL(valor)}.` : 'Zero registra bonificação.'];
    if (ref !== null) partes.push(`Custo de referência atual: ${formatarBRL(ref)}; ele não muda automaticamente.`);
    return partes.join(' ');
  });

  constructor() {
    effect(() => {
      const sku = this.skuFixo() ?? this.skuInicial();
      if (sku) this.form.controls.sku.setValue(sku);
    });
    this.form.controls.custo.valueChanges.subscribe((v) => this.custoDigitado.set(v));
  }

  ngOnInit(): void {
    const api = this.api;
    this.controle = this.registro.obter<Omit<PedidoEntrada, 'requisicaoId'>, RespostaGravacao>(`entrada:${this.skuFixo() ?? 'livre'}`, (p: PedidoEntrada) => api.registrarEntrada(p));
  }

  protected erro(nome: keyof typeof this.form.controls): string | null {
    return mensagemErro(this.form.controls[nome], this.tentou());
  }

  protected desc(nome: keyof typeof this.form.controls, temDica: boolean): string | null {
    return descricao(`${this.id}-${nome === 'fornecedorId' ? 'fornecedor' : nome}`, temDica, !!this.erro(nome));
  }

  async enviar(): Promise<void> {
    if (this.controle.enviando()) return;
    this.tentou.set(true);
    if (this.form.invalid) {
      afterNextRender(() => focarPrimeiroInvalido(this.formulario().nativeElement), { injector: this.injector });
      return;
    }
    const v = this.form.getRawValue();
    const referencia = textoOpcional(v.referencia);
    const motivo = textoOpcional(v.motivo);
    const ok = await this.controle.enviar({
      sku: v.sku,
      fornecedorId: v.fornecedorId,
      quantidade: paraInteiro(v.quantidade) ?? Number.NaN,
      custoUnitCentavos: paraCentavos(v.custo) ?? Number.NaN,
      ...(referencia ? { referenciaFornecedor: referencia } : {}),
      ...(motivo ? { motivo } : {}),
    });
    const estado = this.controle.estado();
    if (ok && estado.fase === 'sucesso') {
      this.ultimo.set(estado.resposta);
      this.registrado.emit(estado.resposta);
    }
  }

  protected novaEntrada(): void {
    this.controle.novaTentativa();
    this.ultimo.set(null);
    this.tentou.set(false);
    this.form.patchValue({ quantidade: '', referencia: '', motivo: '' });
    this.form.markAsUntouched();
    afterNextRender(() => this.formulario().nativeElement.querySelector<HTMLElement>('select, input')?.focus(), { injector: this.injector });
  }
}
