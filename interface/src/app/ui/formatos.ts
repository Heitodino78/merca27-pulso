import { Pipe, type PipeTransform } from '@angular/core';
import { formatarBRL, formatarInteiro } from '../nucleo/dinheiro';

@Pipe({ name: 'brl' })
export class BrlPipe implements PipeTransform {
  transform(centavos: number | null | undefined): string {
    return formatarBRL(centavos);
  }
}

@Pipe({ name: 'inteiro' })
export class InteiroPipe implements PipeTransform {
  transform(valor: number): string {
    return formatarInteiro(valor);
  }
}

const FORMATO_DATA = new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo',
});

@Pipe({ name: 'dataHora' })
export class DataHoraPipe implements PipeTransform {
  transform(iso: string | null | undefined): string {
    if (!iso) return '—';
    const data = new Date(iso);
    return Number.isNaN(data.getTime()) ? iso : FORMATO_DATA.format(data).replace(/[  ]/g, ' ');
  }
}

const TIPOS: Record<string, string> = {
  SALDO_INICIAL: 'Saldo inicial',
  ENTRADA: 'Entrada',
  PERDA: 'Perda',
  AJUSTE: 'Ajuste por contagem',
  VENDA: 'Venda',
  ESTORNO: 'Estorno',
};

@Pipe({ name: 'tipoMovimento' })
export class TipoMovimentoPipe implements PipeTransform {
  transform(tipo: string): string {
    return TIPOS[tipo] ?? tipo;
  }
}

const CATEGORIAS: Record<string, string> = {
  BEBIDAS: 'Bebidas', MERCEARIA: 'Mercearia', LATICINIOS: 'Laticínios',
  SNACKS: 'Snacks', HIGIENE: 'Higiene', LIMPEZA: 'Limpeza',
  AVARIA: 'Avaria', VENCIMENTO: 'Vencimento', QUEBRA: 'Quebra',
  DINHEIRO: 'Dinheiro', PIX: 'Pix', CARTAO: 'Cartão',
};

@Pipe({ name: 'rotuloCategoria' })
export class RotuloCategoriaPipe implements PipeTransform {
  transform(codigo: string | null | undefined): string {
    if (!codigo) return '—';
    return CATEGORIAS[codigo] ?? codigo;
  }
}

/** Delta com sinal explícito: +10, −3. */
@Pipe({ name: 'delta' })
export class DeltaPipe implements PipeTransform {
  transform(valor: number): string {
    if (valor > 0) return `+${formatarInteiro(valor)}`;
    if (valor < 0) return `−${formatarInteiro(-valor)}`;
    return '0';
  }
}
