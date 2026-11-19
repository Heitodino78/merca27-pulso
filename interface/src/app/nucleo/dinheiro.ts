/*
 * Fronteira entre o texto em reais digitado e os centavos inteiros do núcleo.
 * A interface só converte o formato; o domínio continua validando os valores.
 */

const FORMATO_BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const FORMATO_INTEIRO = new Intl.NumberFormat('pt-BR');

/** Troca o espaço especial do Intl por espaço comum, para leitura e testes estáveis. */
function normalizarEspacos(texto: string): string {
  return texto.replace(/[  ]/g, ' ');
}

export function formatarBRL(centavos: number | null | undefined): string {
  if (centavos === null || centavos === undefined || !Number.isFinite(centavos)) return '—';
  return normalizarEspacos(FORMATO_BRL.format(centavos / 100));
}

export function formatarInteiro(valor: number): string {
  return normalizarEspacos(FORMATO_INTEIRO.format(valor));
}

/**
 * Converte "12,50", "1.234,56", "R$ 7", "12.5" ou "1.234" em centavos inteiros.
 * Com vírgula, ela é o separador decimal e pontos agrupam milhares.
 * Sem vírgula, pontos em grupos de três são milhares; um único ponto com 1 ou 2
 * casas é decimal. Qualquer outra forma é recusada (retorna null).
 */
export function paraCentavos(texto: string): number | null {
  const limpo = texto.trim().replace(/^R\$\s*/i, '');
  let inteiros: string;
  let fracao = '';
  let m: RegExpExecArray | null;
  if ((m = /^(\d{1,3}(?:\.\d{3})+|\d+),(\d{1,2})$/.exec(limpo)) || (m = /^(\d{1,3}(?:\.\d{3})+|\d+)$/.exec(limpo))) {
    inteiros = (m[1] ?? '').replace(/\./g, '');
    fracao = m[2] ?? '';
  } else if ((m = /^(\d+)\.(\d{1,2})$/.exec(limpo))) {
    inteiros = m[1] ?? '';
    fracao = m[2] ?? '';
  } else {
    return null;
  }
  const centavos = Number(inteiros) * 100 + Number(fracao.padEnd(2, '0'));
  return Number.isSafeInteger(centavos) ? centavos : null;
}

/** Converte "12" em 12. Aceita só dígitos; o domínio decide se zero ou o valor é válido. */
export function paraInteiro(texto: string): number | null {
  const limpo = texto.trim();
  if (!/^\d{1,15}$/.test(limpo)) return null;
  const valor = Number(limpo);
  return Number.isSafeInteger(valor) ? valor : null;
}

/** Valor em centavos exibido num campo de reais, para pré-preencher formulários. */
export function centavosParaCampo(centavos: number): string {
  const reais = Math.trunc(centavos / 100);
  const resto = Math.abs(centavos % 100);
  return `${reais},${String(resto).padStart(2, '0')}`;
}
