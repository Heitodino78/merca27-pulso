import { Component, ElementRef, Injector, afterNextRender, computed, effect, inject, input, viewChild, type Signal } from '@angular/core';
import type { RespostaGravacao } from '../nucleo/contratos';
import type { EstadoEnvio } from '../nucleo/envio';

/** O que o aviso precisa de um ControleEnvio. */
export interface VisaoEnvio {
  readonly estado: Signal<EstadoEnvio<RespostaGravacao>>;
  readonly podeRepetir: boolean;
  readonly requisicaoId: string | null;
  repetir(): Promise<boolean>;
  novaTentativa(): void;
}

/**
 * Mostra o que se sabe sobre um envio. Distingue "nada foi gravado" de
 * "o retorno falhou e a gravação pode ter acontecido", e oferece a repetição
 * com a mesma chave quando ela é segura.
 */
@Component({
  selector: 'pulso-aviso-envio',
  template: `
    @let e = estado();
    <div #caixa tabindex="-1" class="outline-none" [attr.data-fase]="e.fase">
      @switch (e.fase) {
        @case ('enviando') {
          <p role="status" class="flex items-center gap-2 rounded-md border border-borda bg-fundo p-3 text-sm font-medium">
            <span aria-hidden="true" class="inline-block size-3 rounded-full bg-verde motion-safe:animate-pulse"></span>
            {{ e.repeticao ? 'Repetindo com a mesma chave…' : 'Enviando…' }} Aguarde a confirmação da gravação.
          </p>
        }
        @case ('sucesso') {
          <div role="status" class="rounded-md border-l-4 border-verde bg-destaque p-3 text-sm text-texto">
            <p class="font-bold text-verde-escuro">{{ e.resposta.mensagem }}</p>
            @if (e.resposta.aviso === 'OPERACAO_DUPLICADA') {
              <p class="mt-1">Esta requisição já estava confirmada. Nada foi duplicado.</p>
            } @else if (e.resposta.recuperada) {
              <p class="mt-1">Uma gravação interrompida desta mesma requisição foi concluída agora, sem duplicar.</p>
            }
            <ng-content select="[sucesso]" />
          </div>
        }
        @case ('rejeitado') {
          <div role="alert" class="rounded-md border-l-4 border-erro bg-erro-claro p-3 text-sm text-texto">
            <p class="font-bold text-erro">Não registrado: nada foi gravado.</p>
            <p class="mt-1">{{ e.erro.mensagem }} <span class="text-suave">({{ e.erro.codigo }})</span></p>
            @if (controle().podeRepetir) {
              <p class="mt-2">
                Atenção: um envio anterior desta mesma chave ficou sem confirmação.
                Repita-o abaixo antes de lançar outra coisa.
              </p>
              <button type="button" class="botao-secundario mt-2" (click)="controle().repetir()">Repetir o envio sem confirmação</button>
            }
          </div>
        }
        @case ('incerto') {
          <div role="alert" class="rounded-md border-l-4 border-ambar bg-ambar-claro p-3 text-sm text-texto">
            <p class="font-bold">Não foi possível confirmar a gravação.</p>
            <p class="mt-1">
              O pedido pode ter sido gravado ou não. Repita com a mesma chave: se já tiver sido gravado,
              o PULSO reconhece a repetição e não duplica.
            </p>
            <p class="mt-1 text-suave">Detalhe: {{ e.erro.mensagem }} ({{ e.erro.codigo }})</p>
            <p class="mt-1 break-all font-mono text-xs text-suave">Chave: {{ controle().requisicaoId }}</p>
            <button type="button" class="botao-principal mt-3" (click)="controle().repetir()">Repetir com a mesma chave</button>
          </div>
        }
        @case ('conflito') {
          <div role="alert" class="rounded-md border-l-4 border-erro bg-erro-claro p-3 text-sm text-texto">
            <p class="font-bold text-erro">Chave já usada com outros dados: nada foi alterado agora.</p>
            <p class="mt-1">
              A tentativa anterior com esta chave foi registrada com valores diferentes dos atuais.
              Confira o histórico antes de começar um novo lançamento, para não registrar duas vezes.
            </p>
            <p class="mt-1 text-suave">({{ e.erro.codigo }})</p>
            <button type="button" class="botao-secundario mt-3" (click)="controle().novaTentativa()">Começar um novo lançamento</button>
          </div>
        }
        @case ('pendente') {
          <div role="alert" class="rounded-md border-l-4 border-ambar bg-ambar-claro p-3 text-sm text-texto">
            <p class="font-bold">Há uma operação anterior aguardando reconciliação.</p>
            <p class="mt-1">{{ e.erro.mensagem }} Nada novo foi gravado.</p>
            <button type="button" class="botao-principal mt-3" (click)="controle().repetir()">Tentar de novo com a mesma chave</button>
          </div>
        }
      }
    </div>
  `,
})
export class AvisoEnvio {
  readonly controle = input.required<VisaoEnvio>();
  protected readonly estado = computed(() => this.controle().estado());
  private readonly caixa = viewChild.required<ElementRef<HTMLElement>>('caixa');

  constructor() {
    const injector = inject(Injector);
    effect(() => {
      const fase = this.estado().fase;
      if (fase === 'ocioso' || fase === 'enviando') return;
      // O resultado recebe o foco para ser anunciado e para o teclado continuar dali.
      afterNextRender(() => this.caixa().nativeElement.focus(), { injector });
    });
  }
}
