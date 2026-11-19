'use strict';
/* Gera o catálogo sintético de forma determinística: mesma semente, mesmo arquivo. */
const fs = require('node:fs');
const path = require('node:path');

const SEMENTE_PADRAO = 27;
const DESTINO = path.join(__dirname, '..', 'fixtures', 'catalogo-seed.json');

// Nomes genéricos e inventados, sem marcas, códigos de barras ou dados de lojas reais.
const MODELOS = [
  { nome: 'Água Mineral Fictícia 500 ml', categoria: 'BEBIDAS', custo: [120, 220] },
  { nome: 'Arroz Demonstração 1 kg', categoria: 'MERCEARIA', custo: [380, 620] },
  { nome: 'Leite Demonstração 1 L', categoria: 'LATICINIOS', custo: [340, 520] },
  { nome: 'Biscoito Salgado Fictício 100 g', categoria: 'SNACKS', custo: [210, 390] },
  { nome: 'Sabonete Demonstração 90 g', categoria: 'HIGIENE', custo: [150, 310] },
  { nome: 'Detergente Fictício 500 ml', categoria: 'LIMPEZA', custo: [170, 330] },
];

function criarGerador(semente) {
  let estado = semente >>> 0;
  return function proximo() {
    estado = (estado + 0x6d2b79f5) >>> 0;
    let t = estado;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function gerarCatalogo(semente = SEMENTE_PADRAO) {
  const aleatorio = criarGerador(semente);
  const entre = (minimo, maximo) => minimo + Math.floor(aleatorio() * (maximo - minimo + 1));
  const produtos = MODELOS.map((modelo, indice) => {
    const custoRefCentavos = entre(modelo.custo[0], modelo.custo[1]);
    const estoqueMinimo = entre(4, 10);
    return {
      sku: `MER-${String(indice + 1).padStart(3, '0')}`,
      nome: modelo.nome,
      categoria: modelo.categoria,
      unidade: 'UN',
      precoVendaCentavos: Math.round(custoRefCentavos * (1 + entre(25, 45) / 100)),
      custoRefCentavos,
      estoqueMinimo,
      estoqueAlvo: estoqueMinimo + entre(6, 14),
      ativo: true,
    };
  });
  const fornecedores = MODELOS.slice(0, 6).map((modelo, indice) => ({
    fornecedorId: `FOR-${String(indice + 1).padStart(3, '0')}`,
    nomeFicticio: `Distribuidora Demonstração ${String(indice + 1).padStart(2, '0')}`,
    categoriaPrincipal: modelo.categoria, prazoEstimadoDias: indice + 1, ativo: true,
  }));
  return { aviso: 'Dados 100% sintéticos para demonstração.', semente, produtos, fornecedores };
}

const serializar = (catalogo) => `${JSON.stringify(catalogo, null, 2)}\n`;

if (require.main === module) {
  fs.mkdirSync(path.dirname(DESTINO), { recursive: true });
  fs.writeFileSync(DESTINO, serializar(gerarCatalogo()));
  console.log(`Catálogo gerado em ${path.relative(process.cwd(), DESTINO)}`);
}

module.exports = { gerarCatalogo, serializar, SEMENTE_PADRAO };
