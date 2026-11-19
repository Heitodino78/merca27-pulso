/* Validações puras reutilizadas pelos modelos. Retornam texto do problema ou null. */
/** @type {PulsoNucleo} */
var PULSO = PULSO || /** @type {PulsoNucleo} */ ({});

function pulsoCriarValidacao() {
  const PADRAO_SKU = /^MER-\d{3,6}$/;
  const PADRAO_REQUISICAO = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,79}$/;
  const CONTROLE = /[\u0000-\u001F\u007F]/;
  // Em planilhas, texto iniciado por estes sinais pode ser interpretado como fórmula.
  const INICIO_DE_FORMULA = /^[=+\-@]/;

  function inteiroSeguro(valor) {
    return typeof valor === 'number' && Number.isSafeInteger(valor);
  }

  function inteiroNaoNegativo(valor) {
    return inteiroSeguro(valor) && valor >= 0;
  }

  function inteiroPositivo(valor) {
    return inteiroSeguro(valor) && valor > 0;
  }

  function skuValido(sku) {
    return typeof sku === 'string' && PADRAO_SKU.test(sku);
  }

  function requisicaoValida(requisicaoId) {
    return typeof requisicaoId === 'string' && PADRAO_REQUISICAO.test(requisicaoId);
  }

  function problemaTexto(valor, rotulo, minimo, maximo) {
    if (typeof valor !== 'string') return rotulo + ' deve ser um texto.';
    if (valor !== valor.trim()) return rotulo + ' não pode começar nem terminar com espaço.';
    if (valor.length < minimo || valor.length > maximo) {
      return rotulo + ' deve ter entre ' + minimo + ' e ' + maximo + ' caracteres.';
    }
    if (CONTROLE.test(valor)) return rotulo + ' contém caracteres de controle.';
    if (INICIO_DE_FORMULA.test(valor)) return rotulo + ' não pode começar com =, +, - ou @.';
    return null;
  }

  function camposDesconhecidos(objeto, permitidos) {
    return Object.keys(objeto).filter(function (campo) {
      return permitidos.indexOf(campo) === -1;
    });
  }

  function eObjeto(valor) {
    return typeof valor === 'object' && valor !== null && !Array.isArray(valor);
  }

  return {
    inteiroSeguro: inteiroSeguro,
    inteiroNaoNegativo: inteiroNaoNegativo,
    inteiroPositivo: inteiroPositivo,
    skuValido: skuValido,
    requisicaoValida: requisicaoValida,
    problemaTexto: problemaTexto,
    camposDesconhecidos: camposDesconhecidos,
    eObjeto: eObjeto,
  };
}
PULSO.validacao = pulsoCriarValidacao();
