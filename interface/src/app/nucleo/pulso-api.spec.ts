import { TestBed } from '@angular/core/testing';
import { classificarFalhaGravacao } from './classificacao';
import { PulsoApi } from './pulso-api';
import { FalhaTransporte, TRANSPORTE_PULSO, criarTransporteAppsScript, type TransportePulso } from './transporte';

function comTransporte(chamar: TransportePulso['chamar']): PulsoApi {
  TestBed.configureTestingModule({ providers: [{ provide: TRANSPORTE_PULSO, useValue: { chamar } }] });
  return TestBed.inject(PulsoApi);
}

const entrada = { requisicaoId: 'UI-1', sku: 'MER-001', quantidade: 1, custoUnitCentavos: 100, fornecedorId: 'FOR-001' };

describe('classificação de falhas de gravação', () => {
  it('distingue recusa antes de gravar, conflito, pendência e incerteza', () => {
    expect(classificarFalhaGravacao({ codigo: 'QTD_INVALIDA', mensagem: '' })).toBe('nada-gravado');
    expect(classificarFalhaGravacao({ codigo: 'SKU_INATIVO', mensagem: '' })).toBe('nada-gravado');
    expect(classificarFalhaGravacao({ codigo: 'LOCK_OCUPADO', mensagem: '' })).toBe('nada-gravado');
    for (const codigo of ['VENDA_INEXISTENTE', 'VENDA_JA_ESTORNADA']) {
      expect(classificarFalhaGravacao({ codigo, mensagem: '' })).toBe('nada-gravado');
    }
    expect(classificarFalhaGravacao({ codigo: 'REQUISICAO_CONFLITANTE', mensagem: '' })).toBe('conflito');
    expect(classificarFalhaGravacao({ codigo: 'RECONCILIACAO_PENDENTE', mensagem: '' })).toBe('pendente');
    for (const codigo of ['FALHA_GRAVACAO', 'DADOS_INCONSISTENTES', 'FALHA_INESPERADA', 'CODIGO_NOVO']) {
      expect(classificarFalhaGravacao({ codigo, mensagem: '' })).toBe('incerto');
    }
  });
});

describe('PulsoApi', () => {
  it('repassa o pedido ao transporte sem alterar e devolve o sucesso', async () => {
    const recebidos: unknown[] = [];
    const api = comTransporte(async (acao, pedido) => { recebidos.push([acao, pedido]); return { ok: true, operacaoId: 'OPR-1', mensagem: 'Entrada registrada.' }; });
    const r = await api.registrarEntrada(entrada);
    expect(r.ok).toBe(true);
    expect(recebidos).toEqual([['registrarEntrada', entrada]]);
  });

  it('falha de comunicação depois do envio é incerta; antes do envio, nada foi gravado', async () => {
    let enviado = true;
    const api = comTransporte(async () => { throw new FalhaTransporte('rede', enviado); });
    const depois = await api.registrarEntrada(entrada);
    expect(depois.ok === false && depois.certeza).toBe('incerto');
    enviado = false;
    const antes = await api.registrarEntrada(entrada);
    expect(antes.ok === false && antes.certeza).toBe('nada-gravado');
  });

  it('resposta malformada nunca vira sucesso', async () => {
    for (const resposta of [undefined, null, 'ok', [], { sucesso: true }, { ok: 'true' }]) {
      TestBed.resetTestingModule();
      const api = comTransporte(async () => resposta);
      const r = await api.registrarEntrada(entrada);
      expect(r.ok).toBe(false);
      expect(r.ok === false && r.certeza).toBe('incerto');
    }
  });

  it('consultas atualizam o contador de pendências e falhas de consulta não têm "certeza"', async () => {
    const api = comTransporte(async () => ({ ok: true, produtos: [], operacoesPendentes: 2 }));
    await api.listarProdutos();
    expect(api.operacoesPendentes()).toBe(2);
    TestBed.resetTestingModule();
    const api2 = comTransporte(async () => { throw new Error('x'); });
    const r = await api2.listarProdutos();
    expect(r).toEqual({ ok: false, erro: { codigo: 'FALHA_COMUNICACAO', mensagem: 'x' } });
  });

  it('consulta sem pedido não envia objeto', async () => {
    const recebidos: unknown[] = [];
    const api = comTransporte(async (acao, pedido) => { recebidos.push([acao, pedido]); return { ok: true, itens: [], operacoesPendentes: 0, aviso: '' }; });
    await api.consultarReposicao();
    expect(recebidos).toEqual([['consultarReposicao', undefined]]);
  });
});

describe('transporte google.script.run', () => {
  it('usa a cadeia withSuccessHandler/withFailureHandler e chama pulsoChamar', async () => {
    const chamadas: unknown[] = [];
    const run = {
      sucesso: (_: unknown) => {},
      withSuccessHandler(f: (v: unknown) => void) { run.sucesso = f; return run; },
      withFailureHandler() { return run; },
      pulsoChamar(acao: string, pedido: object | null) { chamadas.push([acao, pedido]); setTimeout(() => run.sucesso({ ok: true }), 0); },
    };
    const r = await criarTransporteAppsScript({ google: { script: { run } } }).chamar('listarProdutos');
    expect(r).toEqual({ ok: true });
    expect(chamadas).toEqual([['listarProdutos', null]]);
  });

  it('sem google.script.run, falha com certeza de que nada foi enviado', async () => {
    await expect(criarTransporteAppsScript({}).chamar('listarProdutos')).rejects.toMatchObject({ enviado: false });
  });

  it('withFailureHandler vira falha enviada (incerta)', async () => {
    const run = {
      falha: (_: unknown) => {},
      withSuccessHandler() { return run; },
      withFailureHandler(f: (e: unknown) => void) { run.falha = f; return run; },
      pulsoChamar() { setTimeout(() => run.falha(new Error('Tempo esgotado')), 0); },
    };
    await expect(criarTransporteAppsScript({ google: { script: { run } } }).chamar('listarProdutos'))
      .rejects.toMatchObject({ enviado: true, message: 'Tempo esgotado' });
  });
});
