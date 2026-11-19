import type { AbstractControl, ValidatorFn } from '@angular/forms';
import { paraCentavos, paraInteiro } from '../nucleo/dinheiro';

/*
 * Validação de FORMATO apenas, para orientar quem digita. Regras de negócio
 * (quantidade positiva, alvo >= mínimo, saldo suficiente, produto ativo...)
 * continuam exclusivamente no núcleo, que responde com o próprio erro.
 */

const texto = (c: AbstractControl): string => String(c.value ?? '').trim();

export const obrigatorio: ValidatorFn = (c) => (texto(c) ? null : { obrigatorio: true });

export const formatoDinheiro: ValidatorFn = (c) =>
  !texto(c) || paraCentavos(texto(c)) !== null ? null : { dinheiro: true };

export const formatoInteiro: ValidatorFn = (c) =>
  !texto(c) || paraInteiro(texto(c)) !== null ? null : { inteiro: true };

export function mensagemErro(c: AbstractControl, mostrar: boolean): string | null {
  if (!(mostrar || c.touched) || c.valid) return null;
  if (c.hasError('obrigatorio')) return 'Preencha este campo.';
  if (c.hasError('dinheiro')) return 'Use um valor em reais, por exemplo 12,50.';
  if (c.hasError('inteiro')) return 'Use um número inteiro, sem vírgula nem sinal.';
  return 'Valor em formato inválido.';
}

/** Leva o foco ao primeiro campo marcado como inválido dentro do formulário. */
export function focarPrimeiroInvalido(formulario: HTMLElement): void {
  formulario.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
}

/** Remove espaços nas pontas; texto vazio vira undefined (campo opcional ausente). */
export function textoOpcional(valor: string): string | undefined {
  const limpo = valor.trim();
  return limpo ? limpo : undefined;
}
