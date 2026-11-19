import { type Type } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { FalhaTransporte, TRANSPORTE_PULSO } from '../nucleo/transporte';
import { PRODUTOS, TransporteFalso, estabilizar } from '../testes/transporte-falso';
import { VendaNovaPagina } from './venda-nova';
import { VendaDetalhePagina, VendasPagina } from './vendas';

const produtos = [...PRODUTOS, { ...PRODUTOS[0]!, sku: 'MER-003', nome: 'Leite sintético', precoVendaCentavos: 500, saldoAtual: 8 }];
const resumo = {
  vendaId: 'VEN-TESTE', requisicaoId: 'UI-ORIGINAL', registradoEm: '2026-11-19T12:00:00.000Z',
  formaPagamento: 'PIX', totalCentavos: 900, custoEstCentavos: 620, quantidadeItens: 2,
  estado: 'CONFIRMADA', observacao: null, operadorSimulado: 'OPERADOR-DEMO',
};
const detalhe = {
  ok: true, venda: resumo,
  itens: [{ itemId: 'I1', sku: 'MER-001', quantidade: 2, precoUnitCentavos: 200, custoUnitEstCentavos: 160, subtotalCentavos: 400 }],
  movimentos: [{ movimentoId: 'M1', tipo: 'VENDA', sku: 'MER-001', deltaUnidades: -2, registradoEm: resumo.registradoEm }],
  estorno: null, operacoesPendentes: 0,
};
const respostaVenda = { ok: true, vendaId: 'VEN-TESTE', operacaoId: 'OPR-TESTE', totalCentavos: 950, custoEstCentavos: 620, formaPagamento: 'PIX', itens: [], mensagem: 'Venda confirmada.' };

function montar<T>(componente: Type<T>, t: TransporteFalso) {
  const parametros = new BehaviorSubject(convertToParamMap({ id: 'VEN-TESTE' }));
  TestBed.configureTestingModule({
    imports: [componente],
    providers: [provideRouter([]), { provide: TRANSPORTE_PULSO, useValue: t }, { provide: ActivatedRoute, useValue: { paramMap: parametros } }],
  });
  const fixture = TestBed.createComponent(componente);
  return { fixture, el: fixture.nativeElement as HTMLElement, parametros };
}
function preencher(el: HTMLElement, id: string, valor: string) {
  const c = el.querySelector<HTMLInputElement & HTMLSelectElement>(`input#${id}, select#${id}`)!;
  c.value = valor;
  c.dispatchEvent(new Event(c.tagName === 'SELECT' ? 'change' : 'input'));
}
function botao(el: HTMLElement, texto: string) {
  const b = Array.from(el.querySelectorAll('button')).find((x) => x.textContent?.trim() === texto);
  expect(b, texto).toBeDefined();
  return b!;
}
function iniciar(t: TransporteFalso) {
  t.automaticas.set('listarProdutos', { ok: true, produtos, operacoesPendentes: 0 });
  return montar(VendaNovaPagina, t);
}
function dadosValidos(el: HTMLElement) {
  preencher(el, 'item-0-sku', 'MER-001');
  preencher(el, 'item-0-quantidade', '2');
  preencher(el, 'venda-pagamento', 'PIX');
}

describe('VendaNovaPagina', () => {
  it('tem carregamento, vazio, falha de consulta e nova tentativa', async () => {
    const t = new TransporteFalso();
    const { fixture, el } = montar(VendaNovaPagina, t);
    await estabilizar(fixture);
    expect(el.textContent).toContain('Carregando produtos');
    t.daAcao('listarProdutos')[0]!.responder({ ok: false, erro: { codigo: 'FALHA_LEITURA', mensagem: 'Leitura indisponível' } });
    await estabilizar(fixture);
    expect(el.textContent).toContain('Leitura indisponível');
    botao(el, 'Tentar de novo').click();
    await estabilizar(fixture);
    t.daAcao('listarProdutos')[1]!.responder({ ok: true, produtos: [], operacoesPendentes: 0 });
    await estabilizar(fixture);
    expect(el.textContent).toContain('Nenhum produto ativo para vender');
  });

  it('associa rótulos, recusa formato inválido e leva o foco ao campo', async () => {
    const t = new TransporteFalso();
    const { fixture, el } = iniciar(t);
    await estabilizar(fixture);
    for (const c of Array.from(el.querySelectorAll('input, select'))) expect(el.querySelector(`label[for="${c.id}"]`)).not.toBeNull();
    const ids = Array.from(el.querySelectorAll('[id]')).map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    dadosValidos(el);
    preencher(el, 'item-0-quantidade', '1,5');
    botao(el, 'Revisar venda').click();
    await estabilizar(fixture);
    expect(t.daAcao('confirmarVenda').length).toBe(0);
    expect(el.querySelector('#item-0-quantidade')!.getAttribute('aria-invalid')).toBe('true');
    expect(document.activeElement).toBe(el.querySelector('#item-0-quantidade'));
  });

  it('busca por nome ou SKU, exclui inativos e conserva o produto já selecionado', async () => {
    const t = new TransporteFalso();
    const { fixture, el } = iniciar(t);
    await estabilizar(fixture);
    const opcoes = () => Array.from(el.querySelectorAll('#item-0-sku option')).map((o) => (o as HTMLOptionElement).value);
    expect(opcoes()).toEqual(['', 'MER-001', 'MER-003']);
    preencher(el, 'item-0-sku', 'MER-001');
    preencher(el, 'busca-produto-venda', 'leite');
    await estabilizar(fixture);
    expect(opcoes()).toEqual(['', 'MER-001', 'MER-003']);
    preencher(el, 'busca-produto-venda', 'MER-999');
    await estabilizar(fixture);
    expect(opcoes()).toEqual(['', 'MER-001']);
  });

  it('revisa vários itens e valores em BRL antes de enviar, sem decidir o total oficial', async () => {
    const t = new TransporteFalso();
    const { fixture, el } = iniciar(t);
    await estabilizar(fixture);
    dadosValidos(el);
    botao(el, 'Adicionar item').click();
    await estabilizar(fixture);
    preencher(el, 'item-1-sku', 'MER-003');
    preencher(el, 'item-1-quantidade', '1');
    botao(el, 'Revisar venda').click();
    await estabilizar(fixture);
    expect(t.daAcao('confirmarVenda').length).toBe(0);
    expect(el.textContent).toContain('Total para conferência: R$ 9,00');
    expect(document.activeElement).toBe(el.querySelector('#titulo-revisao'));
    botao(el, 'Confirmar venda').click();
    botao(el, 'Confirmar venda').click();
    await estabilizar(fixture);
    expect(t.daAcao('confirmarVenda').length).toBe(1);
    expect(t.daAcao('confirmarVenda')[0]!.pedido).toEqual({ requisicaoId: expect.stringMatching(/^UI-/), formaPagamentoFicticia: 'PIX', itens: [{ sku: 'MER-001', quantidade: 2 }, { sku: 'MER-003', quantidade: 1 }] });
    expect(el.textContent).not.toContain('Total oficial');
    expect(el.querySelector('fieldset')!.disabled).toBe(true);
    t.daAcao('confirmarVenda')[0]!.responder(respostaVenda);
    await estabilizar(fixture);
    expect(el.textContent).toContain('Total oficial R$ 9,50');
    expect(el.querySelector('fieldset')!.disabled).toBe(true);
    expect(el.querySelector('a[href="/vendas/VEN-TESTE"]')).not.toBeNull();
    expect(el.textContent).not.toContain('Confirmar venda');
    el.querySelector('form')!.dispatchEvent(new Event('submit'));
    await estabilizar(fixture);
    expect(t.daAcao('confirmarVenda').length).toBe(1);
    botao(el, 'Nova venda').click();
    await estabilizar(fixture);
    expect(el.textContent).toContain('Revisar venda');
    expect(el.querySelectorAll('ol li').length).toBe(1);
    expect(el.querySelector('fieldset')!.disabled).toBe(false);
  });

  it('repetição depois de falha incerta usa mesmos dados e exibe a confirmação oficial', async () => {
    const t = new TransporteFalso();
    const { fixture, el } = iniciar(t);
    await estabilizar(fixture);
    dadosValidos(el);
    botao(el, 'Revisar venda').click();
    await estabilizar(fixture);
    botao(el, 'Confirmar venda').click();
    await estabilizar(fixture);
    t.daAcao('confirmarVenda')[0]!.falhar(new FalhaTransporte('Retorno perdido', true));
    await estabilizar(fixture);
    botao(el, 'Repetir com a mesma chave').click();
    await estabilizar(fixture);
    expect(t.daAcao('confirmarVenda')[1]!.pedido).toEqual(t.daAcao('confirmarVenda')[0]!.pedido);
    t.daAcao('confirmarVenda')[1]!.responder({ ...respostaVenda, duplicada: true, aviso: 'OPERACAO_DUPLICADA' });
    await estabilizar(fixture);
    expect(el.textContent).toContain('Total oficial R$ 9,50');
    expect(el.textContent).toContain('Nada foi duplicado');
    expect(el.textContent).not.toContain('Confirmar venda');
  });

  for (const [codigo, fase] of [['SALDO_INSUFICIENTE', 'rejeitado'], ['REQUISICAO_CONFLITANTE', 'conflito'], ['RECONCILIACAO_PENDENTE', 'pendente']]) {
    it(`mostra ${codigo} sem anunciar venda confirmada`, async () => {
      const t = new TransporteFalso();
      const { fixture, el } = iniciar(t);
      await estabilizar(fixture);
      dadosValidos(el);
      botao(el, 'Revisar venda').click();
      await estabilizar(fixture);
      botao(el, 'Confirmar venda').click();
      await estabilizar(fixture);
      t.daAcao('confirmarVenda')[0]!.responder({ ok: false, erro: { codigo, mensagem: 'Resposta do núcleo' } });
      await estabilizar(fixture);
      expect(el.querySelector('[data-fase]')!.getAttribute('data-fase')).toBe(fase);
      expect(el.textContent).not.toContain('Total oficial');
    });
  }
});

describe('VendasPagina', () => {
  it('lista, mostra estado derivado e busca tanto venda quanto requisição', async () => {
    const t = new TransporteFalso();
    const { fixture, el } = montar(VendasPagina, t);
    await estabilizar(fixture);
    expect(t.daAcao('listarVendas')[0]!.pedido).toEqual({});
    expect(el.textContent).toContain('Carregando vendas');
    t.daAcao('listarVendas')[0]!.responder({ ok: true, vendas: [resumo, { ...resumo, vendaId: 'VEN-OUTRA', requisicaoId: 'REQ-2', estado: 'ESTORNADA' }], operacoesPendentes: 0 });
    await estabilizar(fixture);
    expect(el.textContent).toContain('Estornada');
    preencher(el, 'busca-vendas', 'ui-original');
    await estabilizar(fixture);
    expect(el.textContent).toContain('1 de 2 venda(s)');
    expect(el.textContent).not.toContain('VEN-OUTRA');
    preencher(el, 'busca-vendas', 'ven-outra');
    await estabilizar(fixture);
    expect(el.textContent).not.toContain('VEN-TESTE');
    preencher(el, 'busca-vendas', 'inexistente');
    await estabilizar(fixture);
    expect(el.textContent).toContain('Nenhuma venda corresponde');
  });

  it('falha e vazio têm mensagem e ação correspondente', async () => {
    const t = new TransporteFalso();
    const { fixture, el } = montar(VendasPagina, t);
    await estabilizar(fixture);
    t.daAcao('listarVendas')[0]!.responder({ ok: false, erro: { codigo: 'FALHA_LEITURA', mensagem: 'Falha sintética' } });
    await estabilizar(fixture);
    botao(el, 'Tentar de novo').click();
    await estabilizar(fixture);
    t.daAcao('listarVendas')[1]!.responder({ ok: true, vendas: [], operacoesPendentes: 0 });
    await estabilizar(fixture);
    expect(el.textContent).toContain('Nenhuma venda registrada');
  });
});

describe('VendaDetalhePagina', () => {
  it('mostra valores históricos e só recarrega após confirmar o estorno, inclusive na repetição', async () => {
    const t = new TransporteFalso();
    const { fixture, el } = montar(VendaDetalhePagina, t);
    await estabilizar(fixture);
    expect(t.daAcao('consultarVenda')[0]!.pedido).toEqual({ vendaId: 'VEN-TESTE' });
    t.daAcao('consultarVenda')[0]!.responder(detalhe);
    await estabilizar(fixture);
    expect(el.textContent).toContain('Custo estimado');
    expect(el.textContent).toContain('−2');
    botao(el, 'Estornar venda').click();
    await estabilizar(fixture);
    expect(t.daAcao('estornarVenda').length).toBe(0);
    expect(document.activeElement).toBe(el.querySelector('#estorno-motivo'));
    preencher(el, 'estorno-motivo', 'Devolução fictícia');
    botao(el, 'Estornar venda').click();
    botao(el, 'Estornar venda').click();
    await estabilizar(fixture);
    expect(t.daAcao('estornarVenda').length).toBe(1);
    expect(t.daAcao('consultarVenda').length).toBe(1);
    t.daAcao('estornarVenda')[0]!.falhar(new FalhaTransporte('Retorno perdido', true));
    await estabilizar(fixture);
    botao(el, 'Repetir com a mesma chave').click();
    await estabilizar(fixture);
    expect(t.daAcao('estornarVenda')[1]!.pedido).toEqual(t.daAcao('estornarVenda')[0]!.pedido);
    t.daAcao('estornarVenda')[1]!.responder({ ok: true, vendaId: 'VEN-TESTE', estornoId: 'EST-1', mensagem: 'Venda estornada.', devolvidos: [] });
    await estabilizar(fixture);
    expect(t.daAcao('consultarVenda').length).toBe(2);
    t.daAcao('consultarVenda')[1]!.responder({ ...detalhe, venda: { ...resumo, estado: 'ESTORNADA' }, estorno: { estornoId: 'EST-1', registradoEm: resumo.registradoEm, motivo: 'Devolução fictícia', operadorSimulado: 'OPERADOR-DEMO' } });
    await estabilizar(fixture);
    expect(el.textContent).toContain('Estornada em');
    expect(el.querySelector('#estorno-motivo')).toBeNull();
  });

  it('venda inexistente informa a causa e permite consultar outro ID da rota', async () => {
    const t = new TransporteFalso();
    const { fixture, el, parametros } = montar(VendaDetalhePagina, t);
    await estabilizar(fixture);
    t.daAcao('consultarVenda')[0]!.responder({ ok: false, erro: { codigo: 'VENDA_INEXISTENTE', mensagem: 'Venda não encontrada' } });
    await estabilizar(fixture);
    expect(el.textContent).toContain('Venda não encontrada');
    parametros.next(convertToParamMap({ id: 'VEN-OUTRA' }));
    await estabilizar(fixture);
    expect(t.daAcao('consultarVenda')[1]!.pedido).toEqual({ vendaId: 'VEN-OUTRA' });
  });
});
