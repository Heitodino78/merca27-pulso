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
  fornecedores              Lista fornecedores fictícios
  cadastrar-fornecedor --fornecedor FOR-007 --nome "Distribuidora Fictícia" --categoria MERCEARIA --prazo 3
  alterar-produto --sku MER-001 --preco 1200 --motivo "Revisão fictícia" [--custo 700 --minimo 5 --alvo 12 --fornecedor FOR-001]
  desativar / reativar --sku MER-001 --motivo "Pausa fictícia"
  saldo-inicial --sku MER-001 --quantidade 7 --custo 600 --motivo "Inventário fictício"
  perda --sku MER-001 --quantidade 2 --categoria-perda AVARIA --motivo "Avaria fictícia"
  ajuste --sku MER-001 --contada 4 --motivo "Contagem fictícia"
  contagem --item MER-001=4 --item MER-002=0 --motivo "Inventário fictício"
                            Contagem de vários SKUs: tudo ou nada, um ajuste por SKU com diferença
  reposicao                 Lista alertas e sugestões para revisão humana
  historico-produto --sku MER-001   Mostra as versões do cadastro

Valores em centavos. Dados em ./data (ou na pasta definida em PULSO_DADOS).`;

const OPCOES_COM_VALOR = ['sku', 'nome', 'categoria', 'preco', 'custo', 'minimo', 'alvo', 'quantidade', 'referencia', 'motivo', 'requisicao', 'fornecedor', 'prazo', 'categoria-perda', 'contada'];

function lerOpcoes(argumentos) {
  const opcoes = {};
  for (let i = 0; i < argumentos.length; i++) {
    const nome = argumentos[i].startsWith('--') ? argumentos[i].slice(2) : null;
    if (nome === 'item' && i + 1 < argumentos.length) (opcoes.item ??= []).push(argumentos[++i]);
    else if (nome === 'inativo') opcoes.inativo = true;
    else if (nome === 'ativo') opcoes.ativo = true;
    else if (OPCOES_COM_VALOR.includes(nome) && i + 1 < argumentos.length) opcoes[nome] = argumentos[++i];
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

/** @type {Record<string, (pulso: ReturnType<typeof criarPulsoLocal>, opcoes?: any) => number>} */
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
      fornecedorId: o.fornecedor,
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
      console.log(`  ${dataHora(m.registradoEm)}  ${m.tipo}  ${m.deltaUnidades > 0 ? '+' : ''}${m.deltaUnidades}  saldo ${m.saldoApos}  ${m.referenciaId ?? ''}  custo unitário ${reais(m.custoUnitCentavos)}  ${m.fornecedorId ?? ''}  ${m.categoriaPerda ?? ''}`);
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

function executarEscrita(pulso, metodo, opcoes, dados) {
  const requisicaoId = requisicao(opcoes);
  const r = pulso[metodo]({ requisicaoId, ...dados });
  if (!r.ok) return imprimirErro(r, requisicaoId);
  console.log(`OK: ${r.mensagem}${r.saldoAtual === undefined ? '' : ` Saldo atual ${r.saldoAtual}.`}`);
  console.log(`Requisição: ${requisicaoId}${r.duplicada ? ' (já confirmada)' : ''}`);
  return 0;
}

comandos['cadastrar-fornecedor'] = (pulso, o) => executarEscrita(pulso, 'cadastrarFornecedor', o, {
  fornecedorId: o.fornecedor, nomeFicticio: o.nome, categoriaPrincipal: o.categoria, prazoEstimadoDias: numero(o.prazo), ativo: !o.inativo,
});
comandos.fornecedores = (pulso) => {
  const r = pulso.listarFornecedores();
  if (!r.ok) return imprimirErro(r);
  for (const f of r.fornecedores) console.log(`${f.fornecedor_id}  ${f.nome_ficticio}  ${f.categoria_principal}  prazo fictício ${f.prazo_estimado_dias} dia(s)${f.ativo ? '' : '  INATIVO'}`);
  return 0;
};
comandos['alterar-produto'] = (pulso, o) => {
  const campos = {};
  for (const [opcao, campo] of Object.entries({ nome: 'nome', categoria: 'categoria', preco: 'precoVendaCentavos', custo: 'custoRefCentavos', minimo: 'estoqueMinimo', alvo: 'estoqueAlvo', fornecedor: 'fornecedorId' })) {
    if (o[opcao] !== undefined) campos[campo] = ['preco', 'custo', 'minimo', 'alvo'].includes(opcao) ? numero(o[opcao]) : o[opcao];
  }
  if (o.inativo) campos.ativo = false;
  if (o.ativo) campos.ativo = true;
  return executarEscrita(pulso, 'alterarProduto', o, { sku: o.sku, campos, motivo: o.motivo });
};
for (const [comando, metodo] of [['desativar', 'desativarProduto'], ['reativar', 'reativarProduto']]) {
  comandos[comando] = (pulso, o) => executarEscrita(pulso, metodo, o, { sku: o.sku, motivo: o.motivo });
}
comandos['saldo-inicial'] = (pulso, o) => executarEscrita(pulso, 'registrarSaldoInicial', o, { sku: o.sku, quantidade: numero(o.quantidade), custoUnitCentavos: numero(o.custo), motivo: o.motivo });
comandos.perda = (pulso, o) => executarEscrita(pulso, 'registrarPerda', o, { sku: o.sku, quantidade: numero(o.quantidade), categoriaPerda: o['categoria-perda'], motivo: o.motivo });
comandos.ajuste = (pulso, o) => executarEscrita(pulso, 'ajustarPorContagem', o, { sku: o.sku, quantidadeContada: numero(o.contada), motivo: o.motivo });
// Cada --item é SKU=quantidade. Formato inválido segue como texto e o domínio recusa.
comandos.contagem = (pulso, o) => {
  const itens = (o.item ?? []).map((texto) => {
    const separador = texto.indexOf('=');
    return separador < 0 ? { sku: texto } : { sku: texto.slice(0, separador), quantidadeContada: numero(texto.slice(separador + 1)) };
  });
  const requisicaoId = requisicao(o);
  const r = pulso.registrarContagem({ requisicaoId, itens, motivo: o.motivo });
  if (!r.ok) return imprimirErro(r, requisicaoId);
  console.log(`OK: ${r.mensagem}`);
  for (const a of r.ajustados) console.log(`  ${a.sku}: ${a.saldoAnterior} -> ${a.saldoNovo} (${a.deltaUnidades > 0 ? '+' : ''}${a.deltaUnidades})`);
  if (r.semDiferenca.length) console.log(`  Já conferiam: ${r.semDiferenca.join(', ')}`);
  console.log(`Requisição: ${requisicaoId}${r.duplicada ? ' (já confirmada)' : ''}`);
  return 0;
};
comandos.reposicao = (pulso) => {
  const r = pulso.consultarReposicao();
  if (!r.ok) return imprimirErro(r);
  for (const item of r.itens) console.log(`${item.sku}  ${item.nome}  saldo ${item.saldoAtual}  mínimo ${item.estoqueMinimo}  alvo ${item.estoqueAlvo}  sugestão ${item.sugestaoUnidades}  fornecedor ${item.fornecedor?.fornecedor_id ?? 'não associado'}`);
  console.log(r.aviso);
  return 0;
};
comandos['historico-produto'] = (pulso, o) => {
  const r = pulso.consultarHistoricoProduto({ sku: o.sku });
  if (!r.ok) return imprimirErro(r);
  r.versoes.forEach((v, i) => {
    console.log(`v${i + 1}  ${dataHora(v.registradoEm)}  ${v.motivo}  preço ${reais(v.produto.preco_venda_centavos)}  custo ${reais(v.produto.custo_ref_centavos)}  mín ${v.produto.estoque_minimo}  alvo ${v.produto.estoque_alvo}${v.produto.ativo ? '' : '  INATIVO'}`);
  });
  return 0;
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
