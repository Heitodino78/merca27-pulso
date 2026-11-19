import { type Type } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { App } from '../app';
import { appConfig } from '../app.config';
import { routes } from '../app.routes';
import { TRANSPORTE_PULSO } from '../nucleo/transporte';
import { FORNECEDORES, PRODUTOS, TransporteFalso, estabilizar } from '../testes/transporte-falso';
import { FornecedoresPagina } from './fornecedores';
import { ProdutoDetalhePagina } from './produto-detalhe';
import { ProdutosPagina } from './produtos';
import { ReposicaoPagina } from './reposicao';

function montar<T>(componente: Type<T>, transporte: TransporteFalso, rotas = routes) {
  TestBed.configureTestingModule({
    imports: [componente],
    providers: [provideRouter(rotas), { provide: TRANSPORTE_PULSO, useValue: transporte }],
  });
  const fixture = TestBed.createComponent(componente);
  return { fixture, el: fixture.nativeElement as HTMLElement };
}

describe('rotas e HTML Service', () => {
  it('não usa carregamento tardio, que geraria chunks fora do HTML único', () => {
    for (const rota of routes) {
      expect(rota.loadComponent).toBeUndefined();
      expect(rota.loadChildren).toBeUndefined();
    }
  });

  it('a configuração usa rotas por hash', () => {
    const texto = appConfig.providers.flat(5).map((p) => JSON.stringify(p, (_c, v) => (typeof v === 'function' ? v.name : v))).join(' ');
    expect(texto).toContain('HashLocationStrategy');
  });
});

describe('ProdutosPagina', () => {
  it('mostra carregando e depois a lista, com marcação de reposição vinda do núcleo', async () => {
    const t = new TransporteFalso();
    const { fixture, el } = montar(ProdutosPagina, t);
    await estabilizar(fixture);
    expect(el.textContent).toContain('Carregando produtos');
    t.daAcao('listarProdutos')[0]!.responder({ ok: true, produtos: PRODUTOS, operacoesPendentes: 0 });
    t.daAcao('consultarReposicao')[0]!.responder({ ok: true, itens: [{ sku: 'MER-001' }], operacoesPendentes: 0, aviso: '' });
    await estabilizar(fixture);
    expect(el.textContent).toContain('2 de 2 produto(s)');
    expect(el.textContent).toContain('Água Mineral Fictícia 500 ml');
    expect(el.querySelectorAll('tbody tr').length).toBe(2);
    expect(el.querySelector('tbody tr')!.textContent).toContain('Repor');
  });

  it('estado vazio quando não há produtos e quando a busca não encontra nada', async () => {
    const t = new TransporteFalso();
    t.automaticas.set('listarProdutos', { ok: true, produtos: [], operacoesPendentes: 0 });
    t.automaticas.set('consultarReposicao', { ok: true, itens: [], operacoesPendentes: 0, aviso: '' });
    const vazio = montar(ProdutosPagina, t);
    await estabilizar(vazio.fixture);
    expect(vazio.el.textContent).toContain('Nenhum produto cadastrado');
    TestBed.resetTestingModule();

    const t2 = new TransporteFalso();
    t2.automaticas.set('listarProdutos', { ok: true, produtos: PRODUTOS, operacoesPendentes: 0 });
    t2.automaticas.set('consultarReposicao', { ok: true, itens: [], operacoesPendentes: 0, aviso: '' });
    const { fixture, el } = montar(ProdutosPagina, t2);
    await estabilizar(fixture);
    const busca = el.querySelector<HTMLInputElement>('#busca-produtos')!;
    busca.value = 'inexistente';
    busca.dispatchEvent(new Event('input'));
    await estabilizar(fixture);
    expect(el.textContent).toContain('Nenhum produto corresponde à busca');
    busca.value = 'mer-002';
    busca.dispatchEvent(new Event('input'));
    await estabilizar(fixture);
    expect(el.textContent).toContain('1 de 2 produto(s)');
  });

  it('falha de consulta oferece tentar de novo e informa que nada foi alterado', async () => {
    const t = new TransporteFalso();
    t.automaticas.set('consultarReposicao', { ok: true, itens: [], operacoesPendentes: 0, aviso: '' });
    const { fixture, el } = montar(ProdutosPagina, t);
    await estabilizar(fixture);
    t.daAcao('listarProdutos')[0]!.responder({ ok: false, erro: { codigo: 'FALHA_LEITURA', mensagem: 'Não foi possível ler os dados.' } });
    await estabilizar(fixture);
    expect(el.querySelector('[role="alert"]')!.textContent).toContain('FALHA_LEITURA');
    expect(el.textContent).toContain('tentar de novo é seguro');
    Array.from(el.querySelectorAll('button')).find((b) => b.textContent?.includes('Tentar de novo'))!.click();
    await estabilizar(fixture);
    expect(t.daAcao('listarProdutos').length).toBe(2);
  });
});

describe('outras páginas', () => {
  it('reposição vazia explica que nada precisa de reposição', async () => {
    const t = new TransporteFalso();
    t.automaticas.set('consultarReposicao', { ok: true, itens: [], operacoesPendentes: 0, aviso: 'Sugestão para revisão humana.' });
    const { fixture, el } = montar(ReposicaoPagina, t);
    await estabilizar(fixture);
    expect(el.textContent).toContain('Nenhum produto precisa de reposição agora');
  });

  it('fornecedores lista e filtra', async () => {
    const t = new TransporteFalso();
    t.automaticas.set('listarFornecedores', { ok: true, fornecedores: FORNECEDORES, operacoesPendentes: 0 });
    const { fixture, el } = montar(FornecedoresPagina, t);
    await estabilizar(fixture);
    expect(el.textContent).toContain('2 de 2 fornecedor(es)');
    const busca = el.querySelector<HTMLInputElement>('#busca-fornecedores')!;
    busca.value = 'atacado';
    busca.dispatchEvent(new Event('input'));
    await estabilizar(fixture);
    expect(el.textContent).toContain('1 de 2 fornecedor(es)');
  });

  it('detalhe mostra saldo, histórico recente primeiro, versões e aviso de produto inativo', async () => {
    const t = new TransporteFalso();
    t.automaticas.set('listarFornecedores', { ok: true, fornecedores: FORNECEDORES, operacoesPendentes: 0 });
    t.automaticas.set('consultarReposicao', { ok: true, itens: [], operacoesPendentes: 0, aviso: '' });
    t.automaticas.set('consultarEstoque', {
      ok: true, sku: 'MER-002', nome: 'Arroz Demonstração 1 kg', categoria: 'MERCEARIA', unidade: 'UN', ativo: false,
      precoVendaCentavos: 754, custoRefCentavos: 580, fornecedorId: 'FOR-002', criadoEm: '2026-11-18T12:00:00.000Z', atualizadoEm: '2026-11-18T13:00:00.000Z',
      saldoAtual: 7, estoqueMinimo: 5, estoqueAlvo: 11, totalMovimentos: 2, operacoesPendentes: 0,
      historico: [
        { movimentoId: 'M1', operacaoId: 'O1', tipo: 'ENTRADA', deltaUnidades: 10, saldoApos: 10, motivo: null, referenciaId: 'NF-1', registradoEm: '2026-11-18T12:10:00.000Z', operadorSimulado: 'OPERADOR-DEMO', custoUnitCentavos: 600, fornecedorId: 'FOR-002', categoriaPerda: null, saldoAnterior: null, saldoNovo: null },
        { movimentoId: 'M2', operacaoId: 'O2', tipo: 'PERDA', deltaUnidades: -3, saldoApos: 7, motivo: 'Avaria fictícia', referenciaId: null, registradoEm: '2026-11-18T12:20:00.000Z', operadorSimulado: 'OPERADOR-DEMO', custoUnitCentavos: 580, fornecedorId: null, categoriaPerda: 'AVARIA', saldoAnterior: null, saldoNovo: null },
      ],
    });
    t.automaticas.set('consultarHistoricoProduto', { ok: true, sku: 'MER-002', versoes: [
      { produto: { sku: 'MER-002', nome: 'Arroz Demonstração 1 kg', categoria_id: 'MERCEARIA', unidade: 'UN', preco_venda_centavos: 700, custo_ref_centavos: 580, estoque_minimo: 5, estoque_alvo: 11, fornecedor_id: 'FOR-002', ativo: true, criado_em: '', atualizado_em: '', operacao_id: 'O0' }, operacaoId: 'O0', alteracaoId: null, motivo: 'Cadastro inicial', registradoEm: '2026-11-18T12:00:00.000Z', operadorSimulado: null },
      { produto: { sku: 'MER-002', nome: 'Arroz Demonstração 1 kg', categoria_id: 'MERCEARIA', unidade: 'UN', preco_venda_centavos: 754, custo_ref_centavos: 580, estoque_minimo: 5, estoque_alvo: 11, fornecedor_id: 'FOR-002', ativo: false, criado_em: '', atualizado_em: '', operacao_id: 'O0' }, operacaoId: 'O3', alteracaoId: 'A3', motivo: 'Pausa fictícia', registradoEm: '2026-11-18T13:00:00.000Z', operadorSimulado: 'OPERADOR-DEMO' },
    ] });
    const { fixture, el } = montar(ProdutoDetalhePagina, t, [{ path: '**', component: ProdutoDetalhePagina }]);
    await estabilizar(fixture);
    expect(el.querySelector('h1')!.textContent).toContain('Arroz Demonstração 1 kg');
    expect(el.textContent).toContain('Inativo: não aceita entradas');
    expect(el.textContent).toContain('o PULSO recusará a entrada');
    const linhas = el.querySelectorAll('tbody tr');
    expect(linhas[0]!.textContent).toContain('Perda');
    expect(linhas[0]!.textContent).toContain('−3');
    expect(linhas[1]!.textContent).toContain('Entrada');
    expect(el.textContent).toContain('Preço: R$ 7,00 → R$ 7,54; Situação: ativo → inativo.');
    expect(el.textContent).toContain('Reativar produto');
  });
});

describe('App: navegação', () => {
  it('a gaveta do menu abre no botão, fecha com Esc e devolve o estado', async () => {
    const t = new TransporteFalso();
    TestBed.configureTestingModule({ imports: [App], providers: [provideRouter(routes), { provide: TRANSPORTE_PULSO, useValue: t }] });
    const fixture = TestBed.createComponent(App);
    const el = fixture.nativeElement as HTMLElement;
    await estabilizar(fixture);
    const abrir = el.querySelector<HTMLButtonElement>('button[aria-controls="menu-gaveta"]')!;
    expect(abrir.getAttribute('aria-expanded')).toBe('false');
    abrir.click();
    await estabilizar(fixture);
    const gaveta = el.querySelector('#menu-gaveta')!;
    expect(gaveta.getAttribute('role')).toBe('dialog');
    expect(Array.from(gaveta.querySelectorAll('a')).map((a) => a.textContent!.trim())).toContain('Visão geral');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await estabilizar(fixture);
    expect(el.querySelector('#menu-gaveta')).toBeNull();
  });

  it('a rota inicial é a visão geral', () => {
    expect(routes.find((r) => r.path === '')?.redirectTo).toBe('visao-geral');
  });
});

describe('App: reconciliação pendente', () => {
  it('mostra o aviso quando uma consulta informa pendências e reconcilia sob demanda', async () => {
    const t = new TransporteFalso();
    t.automaticas.set('listarProdutos', { ok: true, produtos: PRODUTOS, operacoesPendentes: 1 });
    t.automaticas.set('consultarReposicao', { ok: true, itens: [], operacoesPendentes: 1, aviso: '' });
    TestBed.configureTestingModule({ imports: [App], providers: [provideRouter(routes), { provide: TRANSPORTE_PULSO, useValue: t }] });
    const fixture = TestBed.createComponent(App);
    const el = fixture.nativeElement as HTMLElement;
    await fixture.whenStable();
    const { Router } = await import('@angular/router');
    await TestBed.inject(Router).navigateByUrl('/produtos');
    await estabilizar(fixture);
    expect(el.textContent).toContain('aguardando reconciliação');
    const botao = Array.from(el.querySelectorAll('button')).find((b) => b.textContent?.includes('Reconciliar agora'))!;
    botao.click();
    botao.click();
    await estabilizar(fixture);
    expect(t.daAcao('reconciliarPendencias').length).toBe(1);
    t.daAcao('reconciliarPendencias')[0]!.responder({ ok: true, reconciliadas: ['UI-1'] });
    await estabilizar(fixture);
    expect(el.textContent).toContain('Pendências reconciliadas');
  });
});
