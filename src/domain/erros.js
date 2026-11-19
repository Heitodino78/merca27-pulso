/* Códigos de erro e formato único de resposta do PULSO. */
var PULSO = PULSO || {};

PULSO.erros = (function () {
  /** Resposta de rejeição devolvida pelos casos de uso. */
  function falha(codigo, mensagem, detalhes) {
    const erro = { codigo: codigo, mensagem: mensagem };
    if (detalhes) erro.detalhes = detalhes;
    return { ok: false, erro: erro };
  }

  /** Exceção de infraestrutura com código conhecido (lock, leitura, integridade). */
  function criarExcecao(codigo, mensagem) {
    const excecao = new Error(mensagem);
    excecao.codigo = codigo;
    return excecao;
  }

  return { falha: falha, criarExcecao: criarExcecao };
})();
