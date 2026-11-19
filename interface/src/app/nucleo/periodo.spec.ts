import { descreverPeriodo, diaLocal, diasNoPeriodo, inicioDoDia, paraInstantes, periodoDoPreset, problemaPeriodo, somarDias } from './periodo';

describe('período: dias de São Paulo ↔ instantes UTC', () => {
  const agora = Date.parse('2026-11-19T15:00:00.000Z');

  it('meia-noite local é 03:00 UTC e a fronteira do dia fica nos milissegundos certos', () => {
    expect(inicioDoDia('2026-11-19')).toBe('2026-11-19T03:00:00.000Z');
    expect(diaLocal(Date.parse('2026-11-20T02:59:59.999Z'))).toBe('2026-11-19');
    expect(diaLocal(Date.parse('2026-11-20T03:00:00.000Z'))).toBe('2026-11-20');
    // 01:00 UTC ainda é o dia anterior em São Paulo.
    expect(diaLocal(Date.parse('2026-11-19T01:00:00.000Z'))).toBe('2026-11-18');
  });

  it('período em dias vira [desde, ate) com fim exclusivo no dia seguinte', () => {
    expect(paraInstantes({ de: '2026-11-13', ate: '2026-11-19' })).toEqual({ desde: '2026-11-13T03:00:00.000Z', ate: '2026-11-20T03:00:00.000Z' });
    expect(paraInstantes({ de: '2026-12-31', ate: '2026-12-31' })).toEqual({ desde: '2026-12-31T03:00:00.000Z', ate: '2027-01-01T03:00:00.000Z' });
  });

  it('presets contam o dia de hoje', () => {
    expect(periodoDoPreset('hoje', agora)).toEqual({ de: '2026-11-19', ate: '2026-11-19' });
    expect(periodoDoPreset('7d', agora)).toEqual({ de: '2026-11-13', ate: '2026-11-19' });
    expect(diasNoPeriodo(periodoDoPreset('30d', agora))).toBe(30);
    expect(periodoDoPreset('mes', agora)).toEqual({ de: '2026-11-01', ate: '2026-11-19' });
    expect(somarDias('2028-02-28', 1)).toBe('2028-02-29');
  });

  it('recusa formato inválido, ordem invertida e mais de 366 dias', () => {
    expect(problemaPeriodo({ de: '', ate: '2026-11-19' })).toContain('duas datas');
    expect(problemaPeriodo({ de: '2026-02-30', ate: '2026-03-01' })).toContain('duas datas');
    expect(problemaPeriodo({ de: '2026-11-20', ate: '2026-11-19' })).toContain('posterior');
    expect(problemaPeriodo({ de: '2025-11-19', ate: '2026-11-19' })).toBeNull();
    expect(problemaPeriodo({ de: '2025-11-18', ate: '2026-11-19' })).toContain('366');
    expect(descreverPeriodo({ de: '2026-11-19', ate: '2026-11-19' })).toBe('19/11/2026');
  });
});
