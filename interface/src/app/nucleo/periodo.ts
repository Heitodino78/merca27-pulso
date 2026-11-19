import { InjectionToken } from '@angular/core';

/*
 * Fronteira entre dias civis de São Paulo (o que a pessoa escolhe) e os instantes UTC que o
 * núcleo recebe. Mesmo fuso do núcleo (D-064): America/Sao_Paulo como UTC−03:00, sem horário
 * de verão desde 2019. Nenhuma regra de indicador é calculada aqui.
 */

/** Relógio da interface; os testes o substituem por um instante fixo. */
export const RELOGIO = new InjectionToken<() => number>('RELOGIO', { providedIn: 'root', factory: () => () => Date.now() });

const DESLOCAMENTO_MS = 3 * 60 * 60 * 1000;
const DIA_MS = 24 * 60 * 60 * 1000;
export const LIMITE_DIAS = 366;

export type Preset = 'hoje' | '7d' | '30d' | 'mes' | 'personalizado';

/** Dias civis, ambos inclusivos, no formato AAAA-MM-DD. */
export interface PeriodoDias {
  de: string;
  ate: string;
}

export const PRESETS: { id: Preset; rotulo: string }[] = [
  { id: 'hoje', rotulo: 'Hoje' },
  { id: '7d', rotulo: '7 dias' },
  { id: '30d', rotulo: '30 dias' },
  { id: 'mes', rotulo: 'Este mês' },
  { id: 'personalizado', rotulo: 'Personalizado' },
];

export function diaValido(dia: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dia)) return false;
  const ms = Date.parse(`${dia}T00:00:00.000Z`);
  return Number.isFinite(ms) && new Date(ms).toISOString().slice(0, 10) === dia;
}

/** Dia civil em São Paulo de um instante (ms desde a época). */
export function diaLocal(ms: number): string {
  return new Date(ms - DESLOCAMENTO_MS).toISOString().slice(0, 10);
}

/** Instante UTC da meia-noite de São Paulo daquele dia. */
export function inicioDoDia(dia: string): string {
  return new Date(Date.parse(`${dia}T00:00:00.000Z`) + DESLOCAMENTO_MS).toISOString();
}

export function somarDias(dia: string, dias: number): string {
  return new Date(Date.parse(`${dia}T00:00:00.000Z`) + dias * DIA_MS).toISOString().slice(0, 10);
}

/** Quantidade de dias civis do período, contando as duas pontas. */
export function diasNoPeriodo(p: PeriodoDias): number {
  return Math.round((Date.parse(`${p.ate}T00:00:00.000Z`) - Date.parse(`${p.de}T00:00:00.000Z`)) / DIA_MS) + 1;
}

export function periodoDoPreset(preset: Exclude<Preset, 'personalizado'>, agora: number): PeriodoDias {
  const hoje = diaLocal(agora);
  switch (preset) {
    case 'hoje': return { de: hoje, ate: hoje };
    case '7d': return { de: somarDias(hoje, -6), ate: hoje };
    case '30d': return { de: somarDias(hoje, -29), ate: hoje };
    default: return { de: `${hoje.slice(0, 8)}01`, ate: hoje };
  }
}

/** Mensagem do problema de formato, ou null. O núcleo continua validando o período. */
export function problemaPeriodo(p: PeriodoDias): string | null {
  if (!diaValido(p.de) || !diaValido(p.ate)) return 'Informe as duas datas.';
  if (p.ate < p.de) return 'A data final precisa ser igual ou posterior à inicial.';
  if (diasNoPeriodo(p) > LIMITE_DIAS) return `O período pode ter no máximo ${LIMITE_DIAS} dias.`;
  return null;
}

/** [desde, ate) em instantes UTC: da meia-noite do primeiro dia à meia-noite seguinte ao último. */
export function paraInstantes(p: PeriodoDias): { desde: string; ate: string } {
  return { desde: inicioDoDia(p.de), ate: inicioDoDia(somarDias(p.ate, 1)) };
}

const FORMATO_DIA = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' });
const FORMATO_DIA_CURTO = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'UTC' });
const FORMATO_SEMANA = new Intl.DateTimeFormat('pt-BR', { weekday: 'short', timeZone: 'UTC' });

/** "19/11/2026" ou "19/11"; o dia é um rótulo civil, por isso formatado em UTC. */
export function formatarDia(dia: string, curto = false): string {
  const data = new Date(`${dia}T12:00:00.000Z`);
  return (curto ? FORMATO_DIA_CURTO : FORMATO_DIA).format(data);
}

export function diaDaSemana(dia: string): string {
  return FORMATO_SEMANA.format(new Date(`${dia}T12:00:00.000Z`)).replace('.', '');
}

export function descreverPeriodo(p: PeriodoDias): string {
  return p.de === p.ate ? formatarDia(p.de) : `${formatarDia(p.de)} a ${formatarDia(p.ate)}`;
}
