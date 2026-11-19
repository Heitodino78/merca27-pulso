#!/usr/bin/env node
'use strict';
/* Interface mínima de linha de comando. Não contém regra de negócio. */
const crypto = require('node:crypto');
const path = require('node:path');
const { criarPulsoLocal, aplicarCatalogo } = require('./app');

const AJUDA = `PULSO — MERCA 27 (demonstração com dados fictícios)

Comandos:
  seed                      Cadastra o catálogo sintético
  produtos                  Lista produtos e saldos
  cadastrar --sku MER-007 --nome "Produto Teste" --categoria MERCEARIA
            --preco 990 --custo 600 --minimo 5 --alvo 12 [--inativo] [--requisicao ID]
  entrada   --sku MER-001 --quantidade 10 --custo 600 --fornecedor FOR-001 [--referencia NF-TESTE] [--motivo "Texto"] [--requisicao ID]
  saldo     --sku MER-001   Mostra saldo e histórico
  reconciliar               Conclui operações interrompidas

Valores em centavos. Dados em ./data (ou na pasta definida em PULSO_DADOS).`;

const OPCOES_COM_VALOR = ['sku', 'nome', 'categoria', 'preco', 'custo', 'minimo', 'alvo', 'quantidade', 'referencia', 'motivo', 'requisicao', 'fornecedor'];

function lerOpcoes(argumentos) {
  const opcoes = {};
  for (let i = 0; i < argumentos.length; i++) {
    const nome = argumentos[i].replace(/^--/, '');
    if (nome === 'inativo') opcoes.inativo = true;
    else if (argumentos[i].startsWith('--') && OPCOES_COM_VALOR.includes(nome) && i + 1 < argumentos.length) opcoes[nome] = argumentos[++i];
    else throw new Error(`Opção inválida ou sem valor: ${argumentos[i]}`);
  }
  return opcoes;
}

// Só converte inteiros escritos por extenso; o resto segue como texto e o domínio rejeita.
const numero = (valor) => (typeof valor === 'string' && /^-?\d+$/.test(valor) ? Number(valor) : valor);
const requisicao = (opcoes) => opcoes.requisicao ?? `CLI-${crypto.randomUUID()}`;
const reais = (centavos) => (centavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const dataHora = (iso) => new Date(iso).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });

function imprimirErro(resultado, requisicaoId) {
  console.error(`ERRO ${resultado.erro.codigo}: ${resultado.erro.mensagem}`);
  if (requisicaoId && resultado.erro.codigo === 'FALHA_GRAVACAO') console.error(`Requisição: ${requisicaoId}`);
  return 1;
}

const comandos = {
  seed(pulso) {
    const resultados = aplicarCatalogo(pulso);
    const falha = resultados.find((r) => !r.ok);
    if (falha) return imprimirErro(falha);
    console.log(`Catálogo aplicado: ${resultados.filter((r) => !r.duplicada).length} novo(s), ${resultados.filter((r) => r.duplicada).length} já existente(s).`);
    return 0;
  },
  produtos(pulso) {
    const resultado = pulso.listarProdutos();
    if (!resultado.ok) return imprimirErro(resultado);
    if (!resultado.produtos.length) console.log('Nenhum produto cadastrado. Execute o comando seed.');
    for (const p of resultado.produtos) {
      console.log(`${p.sku}  ${p.nome.padEnd(34)} ${reais(p.precoVendaCentavos).padStart(10)}  saldo ${String(p.saldoAtual).padStart(4)}  mín ${p.estoqueMinimo}  alvo ${p.estoqueAlvo}${p.ativo ? '' : '  INATIVO'}`);
    }
    return 0;
  },
  cadastrar(pulso, o) {
    const requisicaoId = requisicao(o);
    const resultado = pulso.cadastrarProduto({
      requisicaoId, sku: o.sku, nome: o.nome, categoria: o.categoria,
      precoVendaCentavos: numero(o.preco), custoRefCentavos: numero(o.custo),
      estoqueMinimo: numero(o.minimo), estoqueAlvo: numero(o.alvo), ativo: !o.inativo,
    });
    if (!resultado.ok) return imprimirErro(resultado, requisicaoId);
    console.log(`OK: ${resultado.mensagem}`);
    return 0;
  },
  entrada(pulso, o) {
    const requisicaoId = requisicao(o);
    const resultado = pulso.registrarEntrada({
      requisicaoId, sku: o.sku, quantidade: numero(o.quantidade),
      referenciaFornecedor: o.referencia, motivo: o.motivo,
      custoUnitCentavos: numero(o.custo), fornecedorId: o.fornecedor,
    });
    if (!resultado.ok) return imprimirErro(resultado, requisicaoId);
    console.log(`OK: ${resultado.mensagem} ${resultado.sku}: saldo atual ${resultado.saldoAtual}.`);
    console.log(`Requisição: ${requisicaoId}`);
    return 0;
  },
  saldo(pulso, o) {
    const r = pulso.consultarEstoque({ sku: o.sku });
    if (!r.ok) return imprimirErro(r);
    console.log(`${r.sku} — ${r.nome}${r.ativo ? '' : ' (INATIVO)'}`);
    console.log(`Saldo atual: ${r.saldoAtual} ${r.unidade} | mínimo ${r.estoqueMinimo} | alvo ${r.estoqueAlvo}`);
    console.log(`Histórico (${r.historico.length} de ${r.totalMovimentos}):`);
    for (const m of r.historico) {
      console.log(`  ${dataHora(m.registradoEm)}  ${m.tipo}  ${m.deltaUnidades > 0 ? '+' : ''}${m.deltaUnidades}  saldo ${m.saldoApos}  ${m.referenciaId ?? ''}`);
    }
    if (r.operacoesPendentes) console.log(`Atenção: ${r.operacoesPendentes} operação(ões) pendente(s). Execute reconciliar.`);
    return 0;
  },
  reconciliar(pulso) {
    const r = pulso.reconciliarPendencias();
    if (!r.ok) return imprimirErro(r);
    console.log(`Operações reconciliadas: ${r.reconciliadas.length}.`);
    return 0;
  },
};

function principal(argumentos) {
  const [comando, ...resto] = argumentos;
  if (!comando || comando === 'ajuda' || comando === '--help') {
    console.log(AJUDA);
    return 0;
  }
  if (!Object.hasOwn(comandos, comando)) {
    console.error(`Comando desconhecido: ${comando}\n\n${AJUDA}`);
    return 2;
  }
  let opcoes;
  try {
    opcoes = lerOpcoes(resto);
  } catch (erro) {
    console.error(erro.message);
    return 2;
  }
  const diretorio = process.env.PULSO_DADOS || path.join(process.cwd(), 'data');
  return comandos[comando](criarPulsoLocal(diretorio), opcoes);
}

process.exitCode = principal(process.argv.slice(2));
