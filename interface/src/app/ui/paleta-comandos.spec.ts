import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { TRANSPORTE_PULSO } from '../nucleo/transporte';
import { PRODUTOS, TransporteFalso, estabilizar } from '../testes/transporte-falso';
import { PaletaComandos, normalizarBusca } from './paleta-comandos';

@Component({ template: '' })
class Vazia {}

function montar() {
  const t = new TransporteFalso();
  t.automaticas.set('listarProdutos', { ok: true, produtos: PRODUTOS, operacoesPendentes: 0 });
  TestBed.configureTestingModule({
    imports: [PaletaComandos],
    providers: [provideRouter([{ path: '**', component: Vazia }]), { provide: TRANSPORTE_PULSO, useValue: t }],
  });
  const fixture = TestBed.createComponent(PaletaComandos);
  return { t, fixture, el: fixture.nativeElement as HTMLElement, router: TestBed.inject(Router) };
}
const tecla = (alvo: EventTarget, key: string, extra: KeyboardEventInit = {}) =>
  alvo.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...extra }));

describe('PaletaComandos', () => {
  it('Ctrl+K abre com foco na busca e mostra páginas e ações', async () => {
    const { fixture, el } = montar();
    await estabilizar(fixture);
    expect(el.querySelector('[role="dialog"]')).toBeNull();
    tecla(document, 'k', { ctrlKey: true });
    await estabilizar(fixture);
    expect(el.querySelector('[role="dialog"]')).not.toBeNull();
    expect(document.activeElement).toBe(el.querySelector('input[role="combobox"]'));
    expect(el.querySelectorAll('[role="option"]').length).toBe(8);
  });

  it('busca sem acento encontra produtos, setas movem e Enter navega', async () => {
    const { fixture, el, router } = montar();
    await estabilizar(fixture);
    tecla(document, 'k', { metaKey: true });
    await estabilizar(fixture);
    const campo = el.querySelector<HTMLInputElement>('input[role="combobox"]')!;
    campo.value = 'agua';
    campo.dispatchEvent(new Event('input'));
    await estabilizar(fixture);
    const opcoes = Array.from(el.querySelectorAll('[role="option"]'));
    expect(opcoes.map((o) => o.textContent)).toEqual([expect.stringContaining('Água Mineral Fictícia 500 ml')]);
    expect(campo.getAttribute('aria-activedescendant')).toBe('paleta-op-0');
    tecla(campo, 'Enter');
    await estabilizar(fixture);
    expect(router.url).toBe('/produtos/MER-001');
    expect(el.querySelector('[role="dialog"]')).toBeNull();
  });

  it('setas circulam entre as opções e Esc fecha', async () => {
    const { fixture, el, router } = montar();
    await estabilizar(fixture);
    tecla(document, '/');
    await estabilizar(fixture);
    const campo = el.querySelector<HTMLInputElement>('input[role="combobox"]')!;
    tecla(campo, 'ArrowUp');
    await estabilizar(fixture);
    expect(campo.getAttribute('aria-activedescendant')).toBe('paleta-op-7');
    tecla(campo, 'ArrowDown');
    tecla(campo, 'ArrowDown');
    await estabilizar(fixture);
    expect(el.querySelector('[aria-selected="true"]')!.textContent).toContain('Produtos');
    tecla(campo, 'Escape');
    await estabilizar(fixture);
    expect(el.querySelector('[role="dialog"]')).toBeNull();
    expect(router.url).toBe('/');
  });

  it('"/" digitado dentro de um campo de texto não abre a paleta', async () => {
    const { fixture, el } = montar();
    const campo = document.createElement('input');
    document.body.appendChild(campo);
    await estabilizar(fixture);
    tecla(campo, '/');
    await estabilizar(fixture);
    expect(el.querySelector('[role="dialog"]')).toBeNull();
    campo.remove();
  });

  it('normaliza acentos e caixa', () => {
    expect(normalizarBusca('  Água SANITÁRIA ')).toBe('agua sanitaria');
  });
});
