import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TRANSPORTE_PULSO } from '../nucleo/transporte';
import { FalhaTransporte } from '../nucleo/transporte';
import { FORNECEDORES, PRODUTOS, TransporteFalso, estabilizar } from '../testes/transporte-falso';
import { FormEntrada } from './form-entrada';

describe('FormEntrada', () => {
  let transporte: TransporteFalso;
  let fixture: ComponentFixture<FormEntrada>;
  let el: HTMLElement;

  beforeEach(async () => {
    transporte = new TransporteFalso();
    TestBed.configureTestingModule({
      imports: [FormEntrada],
      providers: [provideRouter([]), { provide: TRANSPORTE_PULSO, useValue: transporte }],
    });
    fixture = TestBed.createComponent(FormEntrada);
    fixture.componentRef.setInput('produtos', PRODUTOS);
    fixture.componentRef.setInput('fornecedores', FORNECEDORES);
    el = fixture.nativeElement as HTMLElement;
    await estabilizar(fixture);
  });

  const campo = (sufixo: string) => el.querySelector<HTMLInputElement & HTMLSelectElement>(`[id$="-${sufixo}"]`)!;
  function preencher(valores: Record<string, string>): void {
    for (const [sufixo, valor] of Object.entries(valores)) {
      const c = campo(sufixo);
      c.value = valor;
      c.dispatchEvent(new Event(c.tagName === 'SELECT' ? 'change' : 'input'));
    }
  }
  const botao = () => el.querySelector<HTMLButtonElement>('button[type="submit"]')!;
  const aviso = () => el.querySelector('pulso-aviso-envio [data-fase]')!;
  const validos = { sku: 'MER-001', fornecedor: 'FOR-001', quantidade: '10', custo: '6,00' };

  it('tem rótulo associado a todo campo', () => {
    for (const controle of Array.from(el.querySelectorAll('input, select'))) {
      expect(el.querySelector(`label[for="${controle.id}"]`), controle.id).not.toBeNull();
    }
  });

  it('formato inválido não chega ao servidor e marca o campo com mensagem associada', async () => {
    preencher({ ...validos, quantidade: '1,5', custo: 'abc' });
    botao().click();
    await estabilizar(fixture);
    expect(transporte.chamadas.length).toBe(0);
    const qtd = campo('quantidade');
    expect(qtd.getAttribute('aria-invalid')).toBe('true');
    const descricao = qtd.getAttribute('aria-describedby')!;
    expect(el.querySelector(`#${descricao.split(' ').pop()}`)?.textContent).toContain('inteiro');
    expect(document.activeElement).toBe(campo('sku').getAttribute('aria-invalid') ? campo('sku') : qtd);
  });

  it('converte reais para centavos inteiros e envia uma única vez no clique duplo', async () => {
    preencher(validos);
    botao().click();
    botao().click();
    el.querySelector('form')!.dispatchEvent(new Event('submit'));
    await estabilizar(fixture);
    expect(transporte.chamadas.length).toBe(1);
    const pedido = transporte.chamadas[0]!.pedido!;
    expect(pedido).toEqual(jasmineLike({ sku: 'MER-001', fornecedorId: 'FOR-001', quantidade: 10, custoUnitCentavos: 600 }));
    expect(String(pedido['requisicaoId'])).toMatch(/^UI-/);
    expect(botao().disabled).toBe(true);
    expect(el.querySelector('fieldset')!.disabled).toBe(true);
    expect(aviso().getAttribute('data-fase')).toBe('enviando');
  });

  it('mostra sucesso somente após a confirmação do servidor', async () => {
    preencher(validos);
    botao().click();
    await estabilizar(fixture);
    expect(el.textContent).not.toContain('Entrada registrada.');
    transporte.chamadas[0]!.responder({ ok: true, operacaoId: 'OPR-9', sku: 'MER-001', quantidade: 10, saldoAtual: 13, mensagem: 'Entrada registrada.' });
    await estabilizar(fixture);
    expect(aviso().getAttribute('data-fase')).toBe('sucesso');
    expect(el.textContent).toContain('Entrada registrada.');
    expect(el.textContent).toContain('Saldo atual: 13');
    expect(document.activeElement).toBe(aviso());
  });

  it('falha incerta oferece repetir com a mesma chave e os mesmos dados', async () => {
    preencher(validos);
    botao().click();
    await estabilizar(fixture);
    transporte.chamadas[0]!.falhar(new FalhaTransporte('Tempo esgotado', true));
    await estabilizar(fixture);
    expect(aviso().getAttribute('data-fase')).toBe('incerto');
    expect(el.textContent).toContain('pode ter sido gravado ou não');
    const chave = transporte.chamadas[0]!.pedido!['requisicaoId'];
    expect(el.textContent).toContain(String(chave));

    const repetir = Array.from(el.querySelectorAll('button')).find((b) => b.textContent?.includes('Repetir com a mesma chave'))!;
    repetir.click();
    await estabilizar(fixture);
    expect(transporte.chamadas.length).toBe(2);
    expect(transporte.chamadas[1]!.pedido).toEqual(transporte.chamadas[0]!.pedido);
    transporte.chamadas[1]!.responder({ ok: true, operacaoId: 'OPR-9', sku: 'MER-001', quantidade: 10, saldoAtual: 13, mensagem: 'Entrada já registrada por esta requisição; o saldo não mudou.', duplicada: true, aviso: 'OPERACAO_DUPLICADA' });
    await estabilizar(fixture);
    expect(el.textContent).toContain('Nada foi duplicado');
  });

  it('erro de domínio é apresentado como "nada foi gravado"', async () => {
    preencher({ ...validos, sku: 'MER-002', quantidade: '0' });
    botao().click();
    await estabilizar(fixture);
    transporte.chamadas[0]!.responder({ ok: false, erro: { codigo: 'SKU_INATIVO', mensagem: 'O SKU MER-002 está inativo e não aceita entrada.' } });
    await estabilizar(fixture);
    expect(aviso().getAttribute('data-fase')).toBe('rejeitado');
    expect(el.textContent).toContain('nada foi gravado');
    expect(el.textContent).toContain('SKU_INATIVO');
  });

  it('conflito de chave é apresentado sem oferecer repetição', async () => {
    preencher(validos);
    botao().click();
    await estabilizar(fixture);
    transporte.chamadas[0]!.falhar(new FalhaTransporte('rede', true));
    await estabilizar(fixture);
    preencher({ quantidade: '12' });
    botao().click();
    await estabilizar(fixture);
    expect(transporte.chamadas[1]!.pedido!['requisicaoId']).toBe(transporte.chamadas[0]!.pedido!['requisicaoId']);
    transporte.chamadas[1]!.responder({ ok: false, erro: { codigo: 'REQUISICAO_CONFLITANTE', mensagem: 'x' } });
    await estabilizar(fixture);
    expect(aviso().getAttribute('data-fase')).toBe('conflito');
    expect(el.textContent).toContain('Chave já usada com outros dados');
    expect(el.textContent).not.toContain('Repetir com a mesma chave');
  });
});

/** Compara só as chaves informadas. */
function jasmineLike(parcial: Record<string, unknown>) {
  return expect.objectContaining(parcial);
}
