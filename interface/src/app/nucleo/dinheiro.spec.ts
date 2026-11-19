import { centavosParaCampo, formatarBRL, paraCentavos, paraInteiro } from './dinheiro';

describe('dinheiro: fronteira BRL ↔ centavos', () => {
  it('converte formatos brasileiros e com ponto decimal para centavos inteiros', () => {
    const casos: [string, number][] = [
      ['12,50', 1250], ['12,5', 1250], ['0,99', 99], ['7', 700], ['R$ 7', 700], ['r$7,05', 705],
      ['1.234,56', 123456], ['1.234', 123400], ['12.5', 1250], ['12.50', 1250], [' 3,00 ', 300], ['0', 0],
      ['1.000.000,01', 100000001],
    ];
    for (const [texto, esperado] of casos) expect(paraCentavos(texto)).toBe(esperado);
  });

  it('recusa formatos ambíguos ou inválidos em vez de adivinhar', () => {
    for (const texto of ['', '-1', '1,234', '12,345', '1.23.4', '12.345,6.7', 'abc', '1,2,3', '1e3', 'NaN', '12.', ',50', '1 000', '99999999999999999999']) {
      expect(paraCentavos(texto)).toBeNull();
    }
  });

  it('nunca produz valor fracionário (evita 0,1 + 0,2)', () => {
    for (let reais = 0; reais < 50; reais++) {
      for (let c = 0; c < 100; c += 7) {
        const valor = paraCentavos(`${reais},${String(c).padStart(2, '0')}`);
        expect(Number.isInteger(valor)).toBe(true);
        expect(valor).toBe(reais * 100 + c);
      }
    }
  });

  it('formata BRL com espaço comum e ida e volta pelo campo', () => {
    expect(formatarBRL(123456)).toBe('R$ 1.234,56');
    expect(formatarBRL(0)).toBe('R$ 0,00');
    expect(formatarBRL(null)).toBe('—');
    for (const c of [0, 5, 99, 100, 1250, 987654]) expect(paraCentavos(centavosParaCampo(c))).toBe(c);
  });

  it('inteiros: só dígitos; zero passa e o domínio decide se vale', () => {
    expect(paraInteiro('10')).toBe(10);
    expect(paraInteiro(' 0 ')).toBe(0);
    for (const t of ['-5', '1,5', '1.5', '', 'dez', '1e2', '9999999999999999']) expect(paraInteiro(t)).toBeNull();
  });
});
