import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import type { Indicadores, SerieDia } from '../nucleo/contratos';
import { RELOGIO } from '../nucleo/periodo';
import { TRANSPORTE_PULSO } from '../nucleo/transporte';
import { TransporteFalso, estabilizar } from '../testes/transporte-falso';
import { topoDoEixo } from '../ui/grafico-serie';
import { formatarKpi } from '../ui/kpi';
import { VisaoGeralPagina } from './visao-geral';

const AGORA = Date.parse('2026-11-19T15:00:00.000Z');

function dia(d: string, receita = 0, devolucoes = 0, vendas = 0): SerieDia {
  return { dia: d, receitaBrutaCentavos: receita, devolucoesCentavos: devolucoes, numeroVendas: vendas, unidadesVendidas: vendas * 2, perdasUnidades: 0 };
}

export function indicadores(extra: Partial<Indicadores> = {}): Indicadores & { ok: true } {
  return {
    ok: true,
    periodo: { desde: '2026-11-13T03:00:00.000Z', ate: '2026-11-20T03:00:00.000Z', fuso: 'America/Sao_Paulo', primeiroDia: '2026-11-13', ultimoDia: '2026-11-19', regra: 'Cada evento conta pela data em que foi registrado.' },
    vendas: { numero: 2, unidades: 6, receitaBrutaCentavos: 4470, cmvCentavos: 2700, estornadasDepois: 1 },
    devolucoes: { numero: 1, unidades: 2, valorCentavos: 500, cmvCentavos: 300, deVendasAnteriores: 1 },
    resultado: { receitaBrutaCentavos: 4470, devolucoesCentavos: 500, receitaAposDevolucoesCentavos: 3970, cmvEstimadoCentavos: 2400,
      margemBrutaCentavos: 1570, margemPercentual: 39.55, ticketMedioCentavos: 2235 },
    perdas: { unidades: 3, valorCentavos: 1800, porCategoria: { AVARIA: { unidades: 2, valorCentavos: 1200 }, VENCIMENTO: { unidades: 1, valorCentavos: 600 }, QUEBRA: { unidades: 0, valorCentavos: 0 } } },
    ajustes: { numero: 1, unidadesAcrescidas: 3, unidadesRetiradas: 0, valorLiquidoCentavos: 900 },
    entradas: { numero: 1, unidades: 4, valorCentavos: 1000 },
    estoqueAtual: { valorCentavos: 123456, unidades: 152, produtosAtivos: 2, abaixoDoMinimo: 1, semEstoque: 0 },
    serie: ['2026-11-13', '2026-11-14', '2026-11-15', '2026-11-16', '2026-11-17', '2026-11-18', '2026-11-19'].map((d, i) => dia(d, i === 6 ? 4470 : 0, i === 5 ? 500 : 0, i === 6 ? 2 : 0)),
    produtosMaisVendidos: [
      { sku: 'MER-001', nome: 'Água Mineral Fictícia 500 ml', unidadesVendidas: 3, receitaBrutaCentavos: 2970, cmvCentavos: 1800, unidadesDevolvidas: 0, devolvidoCentavos: 0 },
      { sku: 'MER-002', nome: 'Arroz Demonstração 1 kg', unidadesVendidas: 3, receitaBrutaCentavos: 1500, cmvCentavos: 900, unidadesDevolvidas: 1, devolvidoCentavos: 500 },
    ],
    totalSkusVendidos: 2,
    origem: { vendaIds: ['VEN-1', 'VEN-2'], estornoIds: ['EST-1'], movimentosPerda: ['MOV-1', 'MOV-2'] },
    formulas: { receitaBruta: 'F-bruta', devolucoes: 'F-devolucoes', receitaAposDevolucoes: 'F-apos', cmvEstimado: 'F-cmv', margemBruta: 'F-margem',
      margemPercentual: 'F-pct', ticketMedio: 'F-ticket', perdas: 'F-perdas', valorEstoque: 'F-estoque' },
    reposicao: { quantidade: 1, itens: [{ sku: 'MER-002', nome: 'Arroz Demonstração 1 kg', saldoAtual: 4, estoqueMinimo: 5, estoqueAlvo: 12, sugestaoUnidades: 8, fornecedor: null, regra: '' }] },
    operacoesPendentes: 0,
    avisos: [],
    ...extra,
  };
}

function montar() {
  const t = new TransporteFalso();
  TestBed.configureTestingModule({
    imports: [VisaoGeralPagina],
    providers: [provideRouter([]), { provide: TRANSPORTE_PULSO, useValue: t }, { provide: RELOGIO, useValue: () => AGORA }],
  });
  const fixture = TestBed.createComponent(VisaoGeralPagina);
  return { t, fixture, el: fixture.nativeElement as HTMLElement };
}
const botao = (el: HTMLElement, texto: string) => {
  const b = Array.from(el.querySelectorAll('button')).find((x) => x.textContent?.trim() === texto);
  expect(b, texto).toBeDefined();
  return b!;
};
const kpi = (el: HTMLElement, rotulo: string) => el.querySelector(`[data-kpi="${rotulo}"]`)!;
const valorKpi = (el: HTMLElement, rotulo: string) => kpi(el, rotulo).querySelector('[data-kpi-valor]')!.textContent!.trim();

async function pronto(resposta = indicadores()) {
  const m = montar();
  await estabilizar(m.fixture);
  m.t.daAcao('consultarIndicadores')[0]!.responder(resposta);
  await estabilizar(m.fixture);
  return m;
}

describe('VisaoGeralPagina', () => {
  it('começa nos últimos 7 dias de São Paulo, com instantes UTC e esqueleto de carregamento', async () => {
    const { t, fixture, el } = montar();
    await estabilizar(fixture);
    expect(t.daAcao('consultarIndicadores')[0]!.pedido).toEqual({ desde: '2026-11-13T03:00:00.000Z', ate: '2026-11-20T03:00:00.000Z' });
    expect(el.textContent).toContain('Carregando indicadores');
    expect(el.querySelector('[data-periodo]')!.textContent).toBe('13/11/2026 a 19/11/2026');
    expect(botao(el, '7 dias').getAttribute('aria-pressed')).toBe('true');
  });

  it('mostra os números devolvidos pelo núcleo, sem recalcular', async () => {
    const { el } = await pronto();
    expect(valorKpi(el, 'Receita após devoluções')).toBe('R$ 39,70');
    expect(kpi(el, 'Receita após devoluções').textContent).toContain('Bruta R$ 44,70 − devoluções R$ 5,00');
    expect(valorKpi(el, 'Vendas')).toBe('2');
    expect(valorKpi(el, 'Margem bruta estimada')).toBe('R$ 15,70');
    expect(valorKpi(el, 'Margem %')).toBe('39,55%');
    expect(valorKpi(el, 'Ticket médio')).toBe('R$ 22,35');
    expect(valorKpi(el, 'Estoque agora (estimado)')).toBe('R$ 1.234,56');
    expect(kpi(el, 'Devoluções').textContent).toContain('1 de venda(s) anterior(es)');
    expect(el.textContent).toContain('Água Mineral Fictícia 500 ml');
    expect(el.textContent).toContain('+8');
    expect(el.textContent).toContain('Avaria');
  });

  it('N/D e valores negativos aparecem como o núcleo informou, nunca como zero', async () => {
    const r = indicadores();
    r.resultado = { ...r.resultado, receitaAposDevolucoesCentavos: -1980, margemBrutaCentavos: -780, margemPercentual: null, ticketMedioCentavos: null };
    const { el } = await pronto(r);
    expect(valorKpi(el, 'Margem %')).toBe('N/D');
    expect(valorKpi(el, 'Ticket médio')).toBe('N/D');
    expect(valorKpi(el, 'Receita após devoluções')).toBe('-R$ 19,80');
    expect(kpi(el, 'Receita após devoluções').querySelector('[data-kpi-valor]')!.classList).toContain('text-erro');
  });

  it('trocar o período mantém os números na tela e pede o novo intervalo', async () => {
    const { t, fixture, el } = await pronto();
    botao(el, 'Hoje').click();
    await estabilizar(fixture);
    expect(t.daAcao('consultarIndicadores')[1]!.pedido).toEqual({ desde: '2026-11-19T03:00:00.000Z', ate: '2026-11-20T03:00:00.000Z' });
    expect(valorKpi(el, 'Vendas')).toBe('2');
    expect(botao(el, 'Hoje').getAttribute('aria-pressed')).toBe('true');
    t.daAcao('consultarIndicadores')[1]!.responder(indicadores({ vendas: { ...indicadores().vendas, numero: 9 } }));
    await estabilizar(fixture);
    expect(valorKpi(el, 'Vendas')).toBe('9');
  });

  it('período personalizado valida o formato antes de enviar', async () => {
    const { t, fixture, el } = await pronto();
    botao(el, 'Personalizado').click();
    await estabilizar(fixture);
    const de = el.querySelector<HTMLInputElement>('#periodo-de')!;
    const ate = el.querySelector<HTMLInputElement>('#periodo-ate')!;
    de.value = '2026-11-10'; de.dispatchEvent(new Event('input'));
    ate.value = '2026-11-01'; ate.dispatchEvent(new Event('input'));
    botao(el, 'Aplicar').click();
    await estabilizar(fixture);
    expect(t.daAcao('consultarIndicadores').length).toBe(1);
    expect(el.querySelector('#periodo-erro')!.textContent).toContain('posterior');
    expect(de.getAttribute('aria-invalid')).toBe('true');
    ate.value = '2026-11-12'; ate.dispatchEvent(new Event('input'));
    botao(el, 'Aplicar').click();
    await estabilizar(fixture);
    expect(t.daAcao('consultarIndicadores')[1]!.pedido).toEqual({ desde: '2026-11-10T03:00:00.000Z', ate: '2026-11-13T03:00:00.000Z' });
  });

  it('fórmula abre e fecha com o botão de informação, ligado por aria-controls', async () => {
    const { fixture, el } = await pronto();
    const info = kpi(el, 'Ticket médio').querySelector<HTMLButtonElement>('button')!;
    expect(info.getAttribute('aria-expanded')).toBe('false');
    info.click();
    await estabilizar(fixture);
    expect(info.getAttribute('aria-expanded')).toBe('true');
    expect(el.querySelector(`#${info.getAttribute('aria-controls')}`)!.textContent).toContain('F-ticket');
  });

  it('o detalhamento de vendas leva o mesmo período à lista', async () => {
    const { el } = await pronto();
    const link = kpi(el, 'Vendas').querySelector('a')!.getAttribute('href')!;
    expect(link).toContain('/vendas?');
    expect(decodeURIComponent(link)).toContain('desde=2026-11-13T03:00:00.000Z');
    expect(decodeURIComponent(link)).toContain('ate=2026-11-20T03:00:00.000Z');
  });

  it('gráfico: uma barra por dia, setas mostram o dia e anunciam, tabela é alternativa', async () => {
    const { fixture, el } = await pronto();
    expect(el.querySelectorAll('g[data-dia]').length).toBe(7);
    const svg = el.querySelector('svg[role="img"]')!;
    expect(svg.getAttribute('aria-label')).toContain('total R$ 44,70');
    svg.dispatchEvent(new FocusEvent('focus'));
    await estabilizar(fixture);
    expect(el.querySelector('[data-dica-grafico]')!.textContent).toContain('19/11/2026');
    svg.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }));
    await estabilizar(fixture);
    expect(el.querySelector('[data-dica-grafico]')!.textContent).toContain('Devoluções R$ 5,00');
    expect(el.querySelector('pulso-grafico-serie [role="status"]')!.textContent).toContain('18/11/2026');
    botao(el, 'Nº de vendas').click();
    await estabilizar(fixture);
    expect(svg.getAttribute('aria-label')).toContain('Vendas registradas');
    botao(el, 'Ver como tabela').click();
    await estabilizar(fixture);
    expect(el.querySelectorAll('pulso-grafico-serie tbody tr').length).toBe(7);
  });

  it('avisos de pendência são apresentados', async () => {
    const { el } = await pronto(indicadores({ operacoesPendentes: 1, avisos: ['Há operações pendentes de reconciliação.'] }));
    expect(el.textContent).toContain('Há operações pendentes de reconciliação.');
  });

  it('falha de consulta é apresentada e tentar de novo repete a consulta', async () => {
    const falha = montar();
    await estabilizar(falha.fixture);
    falha.t.daAcao('consultarIndicadores')[0]!.responder({ ok: false, erro: { codigo: 'DADOS_INCONSISTENTES', mensagem: 'Dados inconsistentes.' } });
    await estabilizar(falha.fixture);
    expect(falha.el.textContent).toContain('Não foi possível carregar os indicadores.');
    botao(falha.el, 'Tentar de novo').click();
    await estabilizar(falha.fixture);
    expect(falha.t.daAcao('consultarIndicadores').length).toBe(2);
  });
});

describe('formatos do painel', () => {
  it('eixo redondo e KPI sem arredondar centavos', () => {
    expect(topoDoEixo(0)).toBe(1);
    expect(topoDoEixo(4470)).toBe(5000);
    expect(topoDoEixo(1200)).toBe(2000);
    expect(topoDoEixo(230)).toBe(250);
    expect(formatarKpi(null, 'brl')).toBe('N/D');
    expect(formatarKpi(123456, 'brl')).toBe('R$ 1.234,56');
    expect(formatarKpi(12.5, 'pct')).toBe('12,5%');
    expect(formatarKpi(1500, 'inteiro')).toBe('1.500');
  });
});
