import { Component, ElementRef, Injector, afterNextRender, computed, inject, input, output, signal, viewChild, type OnInit } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { CATEGORIAS_PERDA, type RespostaGravacao } from '../nucleo/contratos';
import { formatarBRL, paraCentavos, paraInteiro } from '../nucleo/dinheiro';
import type { ControleEnvio } from '../nucleo/envio';
import { PulsoApi, type ResultadoGravacao } from '../nucleo/pulso-api';
import { RegistroEnvios } from '../nucleo/registro-envios';
import { AvisoEnvio } from '../ui/aviso-envio';
import { Campo, descricao } from '../ui/campo';
import { RotuloCategoriaPipe } from '../ui/formatos';
import { focarPrimeiroInvalido, formatoDinheiro, formatoInteiro, mensagemErro, obrigatorio } from './validacao';

export type TipoAdministrativo = 'SALDO_INICIAL' | 'PERDA' | 'AJUSTE';

interface DadosAdministrativos {
  tipo: TipoAdministrativo;
  sku: string;
  motivo: string;
  quantidade?: number;
  quantidadeContada?: number;
  custoUnitCentavos?: number;
  categoriaPerda?: string;
}

let contador = 0;

/** O tipo viaja nos dados: a mesma chave nunca serve a dois tipos de movimento. */
function executarAdministrativo(api: PulsoApi, p: DadosAdministrativos & { requisicaoId: string }): Promise<ResultadoGravacao<RespostaGravacao>> {
  const base = { requisicaoId: p.requisicaoId, sku: p.sku, motivo: p.motivo };
  switch (p.tipo) {
    case 'SALDO_INICIAL':
      return api.registrarSaldoInicial({ ...base, quantidade: p.quantidade ?? Number.NaN, custoUnitCentavos: p.custoUnitCentavos ?? Number.NaN });
    case 'PERDA':
      return api.registrarPerda({ ...base, quantidade: p.quantidade ?? Number.NaN, categoriaPerda: p.categoriaPerda ?? '' });
    default:
      return api.ajustarPorContagem({ ...base, quantidadeContada: p.quantidadeContada ?? Number.NaN });
  }
}

const TEXTOS: Record<TipoAdministrativo, { botao: string; enviando: string; quantidade: string; dica: string | null }> = {
  SALDO_INICIAL: {
    botao: 'Registrar saldo inicial', enviando: 'Registrando…', quantidade: 'Quantidade inicial (unidades)',
    dica: 'Só é aceito antes de qualquer movimento do produto.',
  },
  PERDA: {
    botao: 'Registrar perda', enviando: 'Registrando…', quantidade: 'Quantidade perdida (unidades)',
    dica: 'Usa o custo de referência vigente do cadastro.',
  },
  AJUSTE: {
    botao: 'Registrar contagem', enviando: 'Registrando…', quantidade: 'Quantidade contada (unidades)',
    dica: 'Informe o que foi contado na prateleira; o PULSO calcula a diferença.',
  },
};

@Component({
  selector: 'pulso-form-administrativo',
  imports: [ReactiveFormsModule, Campo, AvisoEnvio, RotuloCategoriaPipe],
  template: `
    <form #formulario [formGroup]="form" (ngSubmit)="enviar()" novalidate class="space-y-4">
      <fieldset [disabled]="controle.enviando()" class="grid gap-4 sm:grid-cols-2">
        <pulso-campo [id]="id + '-quantidade'" [rotulo]="textos().quantidade" [erro]="erro('quantidade')" [dica]="textos().dica">
          <input [id]="id + '-quantidade'" formControlName="quantidade" inputmode="numeric" autocomplete="off" class="campo-entrada"
                 [attr.aria-invalid]="erro('quantidade') ? true : null" [attr.aria-describedby]="desc('quantidade', !!textos().dica)" />
        </pulso-campo>

        @if (tipo() === 'SALDO_INICIAL') {
          <pulso-campo [id]="id + '-custo'" rotulo="Custo unitário (R$)" [erro]="erro('custo')" [dica]="dicaCusto()">
            <input [id]="id + '-custo'" formControlName="custo" inputmode="decimal" autocomplete="off" placeholder="0,00" class="campo-entrada"
                   [attr.aria-invalid]="erro('custo') ? true : null" [attr.aria-describedby]="desc('custo', true)" />
          </pulso-campo>
        }

        @if (tipo() === 'PERDA') {
          <pulso-campo [id]="id + '-categoria'" rotulo="Categoria da perda" [erro]="erro('categoriaPerda')">
            <select [id]="id + '-categoria'" formControlName="categoriaPerda" class="campo-entrada"
                    [attr.aria-invalid]="erro('categoriaPerda') ? true : null" [attr.aria-describedby]="desc('categoriaPerda', false)">
              <option value="">Selecione a categoria</option>
              @for (c of categoriasPerda; track c) { <option [value]="c">{{ c | rotuloCategoria }}</option> }
            </select>
          </pulso-campo>
        }

        <pulso-campo class="sm:col-span-2" [id]="id + '-motivo'" rotulo="Motivo" [erro]="erro('motivo')" dica="Obrigatório para auditoria (3 a 200 caracteres).">
          <input [id]="id + '-motivo'" formControlName="motivo" autocomplete="off" class="campo-entrada"
                 [attr.aria-invalid]="erro('motivo') ? true : null" [attr.aria-describedby]="desc('motivo', true)" />
        </pulso-campo>
      </fieldset>

      <div class="flex flex-wrap items-center gap-3">
        <button type="submit" class="botao-principal" [disabled]="controle.enviando()">
          {{ controle.enviando() ? textos().enviando : textos().botao }}
        </button>
        @if (controle.estado().fase === 'sucesso') {
          <button type="button" class="botao-secundario" (click)="novoLancamento()">Novo lançamento</button>
        }
      </div>

      <pulso-aviso-envio [controle]="controle">
        @if (ultimo(); as r) {
          <p sucesso class="mt-1">Saldo atual de {{ r.sku }}: <strong>{{ r.saldoAtual }}</strong> unidade(s).</p>
        }
      </pulso-aviso-envio>
    </form>
  `,
})
export class FormAdministrativo implements OnInit {
  private readonly api = inject(PulsoApi);
  private readonly registro = inject(RegistroEnvios);
  private readonly injector = inject(Injector);
  protected readonly id = `adm-${++contador}`;
  protected readonly categoriasPerda = CATEGORIAS_PERDA;

  readonly tipo = input.required<TipoAdministrativo>();
  readonly sku = input.required<string>();
  readonly registrado = output<RespostaGravacao>();

  protected readonly textos = computed(() => TEXTOS[this.tipo()]);
  protected readonly form = new FormGroup({
    quantidade: new FormControl('', { nonNullable: true, validators: [obrigatorio, formatoInteiro] }),
    custo: new FormControl('', { nonNullable: true, validators: [formatoDinheiro] }),
    categoriaPerda: new FormControl('', { nonNullable: true }),
    motivo: new FormControl('', { nonNullable: true, validators: [obrigatorio] }),
  });
  protected readonly tentou = signal(false);
  protected readonly ultimo = signal<RespostaGravacao | null>(null);
  private readonly custoDigitado = signal('');
  private readonly formulario = viewChild.required<ElementRef<HTMLFormElement>>('formulario');

  controle!: ControleEnvio<DadosAdministrativos, RespostaGravacao>;

  protected readonly dicaCusto = computed(() => {
    const valor = paraCentavos(this.custoDigitado());
    return valor !== null ? `Será registrado como ${formatarBRL(valor)}.` : 'Zero é aceito.';
  });

  constructor() {
    this.form.controls.custo.valueChanges.subscribe((v) => this.custoDigitado.set(v));
  }

  ngOnInit(): void {
    const api = this.api;
    this.controle = this.registro.obter(`${this.tipo()}:${this.sku()}`, (p: DadosAdministrativos & { requisicaoId: string }) => executarAdministrativo(api, p));
  }


  protected erro(nome: keyof typeof this.form.controls): string | null {
    const c = this.form.controls[nome];
    // Custo e categoria só são exigidos pelos tipos que os usam.
    if (nome === 'custo' && this.tipo() === 'SALDO_INICIAL' && (this.tentou() || c.touched) && !c.value.trim()) return 'Preencha este campo.';
    if (nome === 'categoriaPerda' && this.tipo() === 'PERDA' && (this.tentou() || c.touched) && !c.value) return 'Selecione a categoria.';
    return mensagemErro(c, this.tentou());
  }

  protected desc(nome: keyof typeof this.form.controls, temDica: boolean): string | null {
    const sufixo = nome === 'categoriaPerda' ? 'categoria' : nome;
    return descricao(`${this.id}-${sufixo}`, temDica, !!this.erro(nome));
  }

  private invalido(): boolean {
    const tipo = this.tipo();
    const nomes: (keyof typeof this.form.controls)[] = ['quantidade', 'motivo'];
    if (tipo === 'SALDO_INICIAL') nomes.push('custo');
    if (tipo === 'PERDA') nomes.push('categoriaPerda');
    return nomes.some((n) => this.erro(n) !== null);
  }

  async enviar(): Promise<void> {
    if (this.controle.enviando()) return;
    this.tentou.set(true);
    if (this.invalido()) {
      afterNextRender(() => focarPrimeiroInvalido(this.formulario().nativeElement), { injector: this.injector });
      return;
    }
    const v = this.form.getRawValue();
    const quantidade = paraInteiro(v.quantidade) ?? Number.NaN;
    const tipo = this.tipo();
    const dados: DadosAdministrativos = { tipo, sku: this.sku(), motivo: v.motivo.trim() };
    if (tipo === 'AJUSTE') dados.quantidadeContada = quantidade;
    else dados.quantidade = quantidade;
    if (tipo === 'SALDO_INICIAL') dados.custoUnitCentavos = paraCentavos(v.custo) ?? Number.NaN;
    if (tipo === 'PERDA') dados.categoriaPerda = v.categoriaPerda;
    const ok = await this.controle.enviar(dados);
    const estado = this.controle.estado();
    if (ok && estado.fase === 'sucesso') {
      this.ultimo.set(estado.resposta);
      this.registrado.emit(estado.resposta);
    }
  }

  protected novoLancamento(): void {
    this.controle.novaTentativa();
    this.ultimo.set(null);
    this.tentou.set(false);
    this.form.reset();
    afterNextRender(() => this.formulario().nativeElement.querySelector<HTMLElement>('input')?.focus(), { injector: this.injector });
  }
}
