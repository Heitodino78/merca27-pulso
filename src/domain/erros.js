/* Códigos de erro e formato único de resposta do PULSO. */
/** @type {PulsoNucleo} */
var PULSO = PULSO || /** @type {PulsoNucleo} */ ({});

function pulsoCriarErros() {
  /** Resposta de rejeição devolvida pelos casos de uso. */
  /** @param {string} codigo @param {string} mensagem @param {object} [detalhes] @returns {FalhaPulso} */
  function falha(codigo, mensagem, detalhes) {
    /** @type {ErroPulso} */
    const erro = { codigo: codigo, mensagem: mensagem };
    if (detalhes) erro.detalhes = detalhes;
    return { ok: false, erro: erro };
  }

  /** Exceção de infraestrutura com código conhecido (lock, leitura, integridade). */
  function criarExcecao(codigo, mensagem) {
    const excecao = Object.assign(new Error(mensagem), { codigo: codigo });
    return excecao;
  }

  return { falha: falha, criarExcecao: criarExcecao };
}
PULSO.erros = pulsoCriarErros();
