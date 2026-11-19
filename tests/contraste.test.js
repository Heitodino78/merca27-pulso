'use strict';
/* M-06: contraste WCAG dos pares de cor usados na interface, lido dos tokens reais do tema. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const INTERFACE = path.join(__dirname, '..', 'interface', 'src');
const css = fs.readFileSync(path.join(INTERFACE, 'styles.css'), 'utf8');
const cor = (nome) => {
  const m = new RegExp(`--color-${nome}:\\s*(#[0-9a-f]{6})`, 'i').exec(css);
  assert.ok(m, `token --color-${nome} ausente`);
  return m[1];
};

function luminancia(hex) {
  const canais = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * canais[0] + 0.7152 * canais[1] + 0.0722 * canais[2];
}
function contraste(a, b) {
  const [l1, l2] = [luminancia(a), luminancia(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}

/** [texto, fundo] efetivamente combinados nos templates. */
const PARES = [
  ['texto', 'fundo'], ['texto', 'superficie'], ['texto', 'destaque'], ['texto', 'ambar'], ['texto', 'ambar-claro'], ['texto', 'erro-claro'],
  ['suave', 'fundo'], ['suave', 'superficie'], ['suave', 'ambar-claro'], ['suave', 'erro-claro'],
  ['verde-escuro', 'destaque'], ['verde-escuro', 'superficie'], ['verde-escuro', 'fundo'],
  ['verde', 'superficie'], ['verde', 'destaque'], ['erro', 'erro-claro'], ['erro', 'superficie'],
  // Fase 3: menu lateral e paleta de comandos.
  ['destaque', 'verde-escuro'], ['texto', 'ambar-claro'], ['verde-escuro', 'ambar-claro'],
];

test('paleta do Documento Mestre preservada nos tokens', () => {
  assert.equal(cor('fundo'), '#f5f5f0');
  assert.equal(cor('texto'), '#1b2725');
  assert.equal(cor('verde'), '#17685b');
  assert.equal(cor('ambar'), '#dca44c');
  assert.equal(cor('destaque'), '#dceae4');
  assert.equal(cor('superficie'), '#ffffff');
});

test('todos os pares de texto usados atingem contraste AA (4,5:1)', () => {
  for (const [texto, fundo] of PARES) {
    const r = contraste(cor(texto), cor(fundo));
    assert.ok(r >= 4.5, `${texto} sobre ${fundo}: ${r.toFixed(2)}:1`);
  }
  for (const fundo of ['verde', 'verde-escuro']) {
    const r = contraste('#ffffff', cor(fundo));
    assert.ok(r >= 4.5, `branco sobre ${fundo}: ${r.toFixed(2)}:1`);
  }
});

test('âmbar nunca é usado como cor de texto sobre fundo claro', () => {
  assert.ok(contraste(cor('ambar'), cor('superficie')) < 4.5, 'premissa: âmbar sobre branco não teria contraste');
  const fontes = fs.readdirSync(path.join(INTERFACE, 'app'), { recursive: true, encoding: 'utf8' })
    .filter((n) => n.endsWith('.ts')).map((n) => fs.readFileSync(path.join(INTERFACE, 'app', n), 'utf8'));
  for (const fonte of fontes) assert.doesNotMatch(fonte, /\btext-ambar\b/);
});

module.exports = { contraste };
