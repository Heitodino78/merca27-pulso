'use strict';
/* Adaptadores locais: tabelas em JSON Lines (somente acréscimo) e trava por arquivo. */
const fs = require('node:fs');
const path = require('node:path');

function excecao(codigo, mensagem) {
  return Object.assign(new Error(mensagem), { codigo });
}

function criarArmazenamentoJsonl(diretorio) {
  fs.mkdirSync(diretorio, { recursive: true });
  const arquivo = (tabela) => path.join(diretorio, `${tabela}.jsonl`);

  return {
    ler(tabela) {
      if (!fs.existsSync(arquivo(tabela))) return [];
      const conteudo = fs.readFileSync(arquivo(tabela), 'utf8');
      if (conteudo === '') return [];
      if (!conteudo.endsWith('\n')) {
        throw excecao('DADOS_INCONSISTENTES', `Dados inconsistentes: ${tabela} termina com linha incompleta.`);
      }
      return conteudo.slice(0, -1).split('\n').map((linha, indice) => {
        try {
          return JSON.parse(linha);
        } catch {
          throw excecao('DADOS_INCONSISTENTES', `Dados inconsistentes: ${tabela}, linha ${indice + 1} ilegível.`);
        }
      });
    },
    anexar(tabela, linha) {
      const descritor = fs.openSync(arquivo(tabela), 'a');
      try {
        fs.writeSync(descritor, `${JSON.stringify(linha)}\n`);
        fs.fsyncSync(descritor);
      } finally {
        fs.closeSync(descritor);
      }
    },
  };
}

function criarLockArquivo(caminho, { limiteMs = 15000, intervaloMs = 25 } = {}) {
  const espera = new Int32Array(new SharedArrayBuffer(4));
  return {
    executar(funcao) {
      const limite = Date.now() + limiteMs;
      let descritor;
      while (descritor === undefined) {
        try {
          descritor = fs.openSync(caminho, 'wx');
        } catch (erro) {
          if (erro.code !== 'EEXIST') throw erro;
          if (Date.now() >= limite) {
            throw excecao('LOCK_OCUPADO', `Outra operação está em andamento. Tente de novo com o mesmo identificador. Se nenhuma estiver rodando, remova ${caminho}.`);
          }
          Atomics.wait(espera, 0, 0, intervaloMs);
        }
      }
      try {
        return funcao();
      } finally {
        fs.closeSync(descritor);
        fs.unlinkSync(caminho);
      }
    },
  };
}

module.exports = { criarArmazenamentoJsonl, criarLockArquivo };
