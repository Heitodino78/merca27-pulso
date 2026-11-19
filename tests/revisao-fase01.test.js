'use strict';
/* Regressões encontradas na revisão independente da Fase 01. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { criarAmbiente, ambienteComProduto, PRODUTO_BASE, FORMATOS, editarPayload } = require('./apoio');

const ENTRADA = Object.freeze({ requisicaoId: 'REV-ENT', sku: 'MER-001', quantidade: 10, custoUnitCentavos: 600, fornecedorId: 'FOR-001' });
const PERDA = Object.freeze({ requisicaoId: 'REV-PER', sku: 'MER-001', quantidade: 2, categoriaPerda: 'AVARIA', motivo: 'Avaria fictícia' });
const ALTERACAO = Object.freeze({ requisicaoId: 'REV-ALT', sku: 'MER-001', campos: { nome: 'Nome Revisado' }, motivo: 'Revisão fictícia' });

/** Move a operação inteira para antes de outra, mantendo cada linha coerente com sua intenção. */
function anteciparOperacao(armazenamento, requisicao, antesDe) {
  const log = armazenamento.tabelas.OPERACOES_LOG;
  const bloco = log.filter((e) => e.requisicao_id === requisicao);
  const resto = log.filter((e) => e.requisicao_id !== requisicao);
  const posicao = resto.findIndex((e) => e.requisicao_id === antesDe);
  assert.ok(bloco.length > 0 && posicao >= 0, 'operações do cenário precisam existir');
  log.splice(0, log.length, ...resto.slice(0, posicao), ...bloco, ...resto.slice(posicao));
}

const VALORES_COMPLEXOS = [
  ['NaN', NaN], ['Infinity', Infinity], ['objeto String', new String('FOR-001')], ['data', new Date(0)],
  ['objeto com toJSON', { toJSON: () => 'FOR-001' }], ['função', () => 'FOR-001'], ['lista', ['FOR-001']], ['objeto', {}],
];
for (const campo of ['fornecedorId', 'nome', 'precoVendaCentavos', 'ativo']) {
  for (const [nome, valor] of VALORES_COMPLEXOS) {
    test(`alteração rejeita ${campo} com ${nome}`, () => {
      const { pulso, armazenamento } = ambienteComProduto();
      assert.equal(pulso.alterarProduto({ ...ALTERACAO, campos: { [campo]: valor } }).erro.codigo, 'DADOS_INVALIDOS');
      assert.equal(armazenamento.tabelas.PRODUTOS_ALTERACOES.length, 0);
    });
  }
}

test('histórico com entrada anterior ao cadastro do produto é recusado', () => {
  const { pulso, armazenamento } = ambienteComProduto();
  assert.equal(pulso.registrarEntrada(ENTRADA).ok, true);
  anteciparOperacao(armazenamento, ENTRADA.requisicaoId, PRODUTO_BASE.requisicaoId);
  assert.equal(pulso.listarProdutos().erro.codigo, 'DADOS_INCONSISTENTES');
});

test('histórico com alteração anterior ao cadastro do produto é recusado', () => {
  const { pulso, armazenamento } = ambienteComProduto();
  assert.equal(pulso.alterarProduto(ALTERACAO).ok, true);
  anteciparOperacao(armazenamento, ALTERACAO.requisicaoId, PRODUTO_BASE.requisicaoId);
  assert.equal(pulso.listarProdutos().erro.codigo, 'DADOS_INCONSISTENTES');
});

test('histórico com entrada em produto já desativado é recusado', () => {
  const { pulso, armazenamento } = ambienteComProduto();
  assert.equal(pulso.registrarEntrada(ENTRADA).ok, true);
  assert.equal(pulso.desativarProduto({ requisicaoId: 'REV-DES', sku: 'MER-001', motivo: 'Pausa fictícia' }).ok, true);
  anteciparOperacao(armazenamento, 'REV-DES', ENTRADA.requisicaoId);
  assert.equal(pulso.listarProdutos().erro.codigo, 'DADOS_INCONSISTENTES');
});

test('histórico com saldo inicial depois de outro movimento é recusado', () => {
  const { pulso, armazenamento } = ambienteComProduto();
  const inicial = { requisicaoId: 'REV-INI', sku: 'MER-001', quantidade: 3, custoUnitCentavos: 600, motivo: 'Inventário fictício' };
  assert.equal(pulso.registrarSaldoInicial(inicial).ok, true);
  assert.equal(pulso.registrarEntrada(ENTRADA).ok, true);
  anteciparOperacao(armazenamento, ENTRADA.requisicaoId, inicial.requisicaoId);
  assert.equal(pulso.listarProdutos().erro.codigo, 'DADOS_INCONSISTENTES');
});

test('histórico com perda maior que o saldo daquele momento é recusado', () => {
  const { pulso, armazenamento } = ambienteComProduto();
  assert.equal(pulso.registrarEntrada(ENTRADA).ok, true);
  assert.equal(pulso.registrarPerda(PERDA).ok, true);
  anteciparOperacao(armazenamento, PERDA.requisicaoId, ENTRADA.requisicaoId);
  assert.equal(pulso.listarProdutos().erro.codigo, 'DADOS_INCONSISTENTES');
});

test('histórico com ajuste fora de ordem é recusado pelos saldos gravados', () => {
  const { pulso, armazenamento } = ambienteComProduto();
  const ajuste = { requisicaoId: 'REV-AJU', sku: 'MER-001', quantidadeContada: 12, motivo: 'Contagem fictícia' };
  assert.equal(pulso.registrarEntrada(ENTRADA).ok, true);
  assert.equal(pulso.ajustarPorContagem(ajuste).ok, true);
  anteciparOperacao(armazenamento, ajuste.requisicaoId, ENTRADA.requisicaoId);
  assert.equal(pulso.listarProdutos().erro.codigo, 'DADOS_INCONSISTENTES');
});

test('histórico com perda antes de mudança de custo não aceita custo de outra versão', () => {
  const { pulso, armazenamento } = ambienteComProduto();
  assert.equal(pulso.registrarEntrada(ENTRADA).ok, true);
  assert.equal(pulso.registrarPerda(PERDA).ok, true);
  assert.equal(pulso.alterarProduto({ ...ALTERACAO, campos: { custoRefCentavos: 700 } }).ok, true);
  anteciparOperacao(armazenamento, ALTERACAO.requisicaoId, PERDA.requisicaoId);
  assert.equal(pulso.listarProdutos().erro.codigo, 'DADOS_INCONSISTENTES');
});

test('reconciliação manual informa quais requisições concluiu', () => {
  const { pulso, armazenamento } = ambienteComProduto();
  armazenamento.falharNaProxima('MOVIMENTOS_ESTOQUE', 'antes');
  assert.equal(pulso.registrarEntrada(ENTRADA).ok, false);
  assert.equal(pulso.consultarEstoque({ sku: 'MER-001' }).operacoesPendentes, 1);
  assert.deepEqual(Array.from(pulso.reconciliarPendencias().reconciliadas), [ENTRADA.requisicaoId]);
  assert.equal(pulso.consultarEstoque({ sku: 'MER-001' }).saldoAtual, 10);
  assert.equal(pulso.reconciliarPendencias().reconciliadas.length, 0);
});

test('toda repetição confirmada recebe aviso e mensagem de operação já realizada', () => {
  const { pulso } = ambienteComProduto();
  const fornecedor = { requisicaoId: 'REV-FOR', fornecedorId: 'FOR-002', nomeFicticio: 'Distribuidora Revisão', categoriaPrincipal: 'SNACKS', prazoEstimadoDias: 2 };
  const casos = [
    ['cadastrarFornecedor', fornecedor],
    ['alterarProduto', ALTERACAO],
    ['registrarEntrada', ENTRADA],
    ['registrarPerda', PERDA],
    ['ajustarPorContagem', { requisicaoId: 'REV-AJU', sku: 'MER-001', quantidadeContada: 5, motivo: 'Contagem fictícia' }],
    ['cadastrarProduto', { ...PRODUTO_BASE }],
  ];
  for (const [metodo, pedido] of casos) {
    pulso[metodo](pedido);
    const repeticao = pulso[metodo](pedido);
    assert.equal(repeticao.ok, true, metodo);
    assert.equal(repeticao.duplicada, true, metodo);
    assert.equal(repeticao.aviso, 'OPERACAO_DUPLICADA', metodo);
    assert.match(repeticao.mensagem, /já|nada foi/i, metodo);
  }
});

test('operação nova não recebe aviso de duplicidade', () => {
  const { pulso } = ambienteComProduto();
  assert.equal(pulso.registrarEntrada(ENTRADA).aviso, undefined);
});

test('falha de leitura em consulta não fala em gravação', () => {
  const { pulso, armazenamento } = ambienteComProduto();
  armazenamento.ler = () => { throw new Error('disco indisponível'); };
  for (const r of [pulso.listarProdutos(), pulso.consultarEstoque({ sku: 'MER-001' }), pulso.consultarReposicao()]) {
    assert.equal(r.erro.codigo, 'FALHA_LEITURA');
    assert.doesNotMatch(r.erro.mensagem, /disco|gravação/i);
  }
});

test('entrada nova faz oito leituras e repetição idempotente faz apenas o carregamento inicial', () => {
  const { pulso, armazenamento } = ambienteComProduto();
  const ler = armazenamento.ler;
  let leituras = 0;
  armazenamento.ler = (tabela) => { leituras++; return ler(tabela); };
  assert.equal(pulso.registrarEntrada(ENTRADA).saldoAtual, 10);
  assert.equal(leituras, 8);
  leituras = 0;
  assert.equal(pulso.registrarEntrada(ENTRADA).duplicada, true);
  assert.equal(leituras, 5);
});

test('reaproveitar leituras não dispensa a conferência da gravação', () => {
  const { pulso, armazenamento } = ambienteComProduto();
  armazenamento.falharNaProxima('MOVIMENTOS_ESTOQUE', 'silencioso');
  assert.equal(pulso.registrarEntrada(ENTRADA).erro.codigo, 'FALHA_GRAVACAO');
  assert.equal(pulso.consultarEstoque({ sku: 'MER-001' }).saldoAtual, 0);
});

test('resposta após gravar reflete o saldo novo mesmo com leituras reaproveitadas', () => {
  const { pulso } = ambienteComProduto();
  assert.equal(pulso.registrarEntrada(ENTRADA).saldoAtual, 10);
  assert.equal(pulso.registrarPerda(PERDA).saldoAtual, 8);
  assert.equal(pulso.consultarEstoque({ sku: 'MER-001' }).saldoAtual, 8);
});

test('listagem e reposição ficam ordenadas por SKU, seja qual for a ordem de cadastro', () => {
  const { pulso } = criarAmbiente();
  for (const sku of ['MER-003', 'MER-001', 'MER-002']) {
    assert.equal(pulso.cadastrarProduto({ ...PRODUTO_BASE, requisicaoId: `REV-${sku}`, sku }).ok, true);
  }
  assert.deepEqual(Array.from(pulso.listarProdutos().produtos, (p) => p.sku), ['MER-001', 'MER-002', 'MER-003']);
  assert.deepEqual(Array.from(pulso.consultarReposicao().itens, (i) => i.sku), ['MER-001', 'MER-002', 'MER-003']);
});

test('CLI mostra o histórico de versões e recusa palavra solta no lugar de opção', (t) => {
  const pasta = fs.mkdtempSync(path.join(os.tmpdir(), 'pulso-cli-revisao-'));
  t.after(() => fs.rmSync(pasta, { recursive: true, force: true }));
  const cli = (...args) => spawnSync(process.execPath, [path.resolve(__dirname, '../local/cli.js'), ...args], {
    encoding: 'utf8', env: { ...process.env, PULSO_DADOS: pasta },
  });
  assert.equal(cli('seed').status, 0);
  assert.equal(cli('alterar-produto', '--sku', 'MER-001', '--preco', '250', '--motivo', 'Reajuste fictício').status, 0);
  const historico = cli('historico-produto', '--sku', 'MER-001');
  assert.equal(historico.status, 0, historico.stderr);
  assert.match(historico.stdout, /v1 .*Cadastro inicial.*R\$\s*2,00/);
  assert.match(historico.stdout, /v2 .*Reajuste fictício.*R\$\s*2,50/);
  assert.match(cli('historico-produto', '--sku', 'MER-999').stderr, /SKU_INEXISTENTE/);
  assert.equal(cli('desativar', 'inativo', '--sku', 'MER-001').status, 2);
});

const INICIAL = Object.freeze({ requisicaoId: 'REV-INI', sku: 'MER-001', quantidade: 7, custoUnitCentavos: 450, motivo: 'Inventário fictício' });

/** Reescreve linha e intenção juntas, simulando adulteração que respeita o formato (legado ou atual). */
function forjarLinha(armazenamento, tabela, requisicao, alterar, formato) {
  const intencao = armazenamento.tabelas.OPERACOES_LOG.find((e) => e.requisicao_id === requisicao && e.estado === 'PENDENTE');
  const registro = editarPayload(intencao, formato, (r) => alterar(r.linha));
  const chave = tabela === 'MOVIMENTOS_ESTOQUE' ? 'movimento_id' : 'alteracao_id';
  const gravada = armazenamento.tabelas[tabela].find((l) => l[chave] === registro.linha[chave]);
  if (gravada) Object.assign(gravada, registro.linha);
}

test('alteração de SKU inexistente retorna erro claro', () => {
  const { pulso } = ambienteComProduto();
  assert.equal(pulso.alterarProduto({ ...ALTERACAO, sku: 'MER-999' }).erro.codigo, 'SKU_INEXISTENTE');
});

test('alteração recusa campo extra no pedido', () => {
  const { pulso, armazenamento } = ambienteComProduto();
  assert.equal(pulso.alterarProduto({ ...ALTERACAO, saldo: 99 }).erro.codigo, 'DADOS_INVALIDOS');
  assert.equal(armazenamento.tabelas.PRODUTOS_ALTERACOES.length, 0);
});

test('perda igual ao saldo é aceita e zera o estoque', () => {
  const { pulso } = ambienteComProduto();
  pulso.registrarEntrada(ENTRADA);
  assert.equal(pulso.registrarPerda({ ...PERDA, quantidade: 10 }).saldoAtual, 0);
});

for (const categoriaPerda of ['CONTAGEM', 'avaria', '', null, undefined, 1]) {
  test(`perda recusa categoria ${JSON.stringify(categoriaPerda)}`, () => {
    const { pulso, armazenamento } = ambienteComProduto();
    pulso.registrarEntrada(ENTRADA);
    assert.equal(pulso.registrarPerda({ ...PERDA, categoriaPerda }).erro.codigo, 'DADOS_INVALIDOS');
    assert.equal(armazenamento.tabelas.MOVIMENTOS_ESTOQUE.length, 1);
  });
}

for (const custoUnitCentavos of [undefined, null, -1, 1.5, NaN, '450']) {
  test(`saldo inicial recusa custo ${String(custoUnitCentavos)}`, () => {
    const { pulso, armazenamento } = ambienteComProduto();
    assert.equal(pulso.registrarSaldoInicial({ ...INICIAL, custoUnitCentavos }).erro.codigo, 'DADOS_INVALIDOS');
    assert.equal(armazenamento.tabelas.MOVIMENTOS_ESTOQUE.length, 0);
  });
}

test('saldo inicial preserva o custo informado, não o custo de referência', () => {
  const { pulso } = ambienteComProduto();
  pulso.registrarSaldoInicial(INICIAL);
  assert.equal(pulso.consultarEstoque({ sku: 'MER-001' }).historico[0].custoUnitCentavos, 450);
});

for (const [metodo, pedido] of [['registrarSaldoInicial', INICIAL], ['registrarPerda', PERDA],
  ['ajustarPorContagem', { requisicaoId: 'REV-AJU', sku: 'MER-001', quantidadeContada: 3, motivo: 'Contagem fictícia' }]]) {
  test(`${metodo} recusa campo extra`, () => {
    const { pulso } = ambienteComProduto();
    assert.equal(pulso[metodo]({ ...pedido, saldo: 99 }).erro.codigo, 'DADOS_INVALIDOS');
  });
}

test('histórico com entrada anterior ao cadastro do fornecedor é recusado', () => {
  const { pulso, armazenamento } = ambienteComProduto();
  pulso.cadastrarFornecedor({ requisicaoId: 'REV-FOR', fornecedorId: 'FOR-002', nomeFicticio: 'Distribuidora Revisão', categoriaPrincipal: 'SNACKS', prazoEstimadoDias: 2 });
  pulso.registrarEntrada({ ...ENTRADA, fornecedorId: 'FOR-002' });
  anteciparOperacao(armazenamento, ENTRADA.requisicaoId, 'REV-FOR');
  assert.equal(pulso.listarProdutos().erro.codigo, 'DADOS_INCONSISTENTES');
});

test('histórico com produto anterior ao cadastro do fornecedor é recusado', () => {
  const { pulso, armazenamento } = criarAmbiente();
  pulso.cadastrarFornecedor({ requisicaoId: 'REV-FOR', fornecedorId: 'FOR-002', nomeFicticio: 'Distribuidora Revisão', categoriaPrincipal: 'SNACKS', prazoEstimadoDias: 2 });
  pulso.cadastrarProduto({ ...PRODUTO_BASE, fornecedorId: 'FOR-002' });
  anteciparOperacao(armazenamento, PRODUTO_BASE.requisicaoId, 'REV-FOR');
  assert.equal(pulso.listarProdutos().erro.codigo, 'DADOS_INCONSISTENTES');
});

test('histórico com alterações fora de ordem não aceita versão inválida do produto', () => {
  const { pulso, armazenamento } = ambienteComProduto();
  pulso.alterarProduto({ ...ALTERACAO, requisicaoId: 'REV-ALVO', campos: { estoqueAlvo: 30 } });
  pulso.alterarProduto({ ...ALTERACAO, requisicaoId: 'REV-MIN', campos: { estoqueMinimo: 20 } });
  anteciparOperacao(armazenamento, 'REV-MIN', 'REV-ALVO');
  assert.equal(pulso.listarProdutos().erro.codigo, 'DADOS_INCONSISTENTES');
});

for (const formato of FORMATOS) {
  test(`alteração confirmada com campos gravados diferentes do efeito do pedido é recusada (payload ${formato})`, () => {
    const { pulso, armazenamento } = ambienteComProduto();
    pulso.alterarProduto({ ...ALTERACAO, campos: { nome: 'Nome Revisado', precoVendaCentavos: 1200 } });
    forjarLinha(armazenamento, 'PRODUTOS_ALTERACOES', ALTERACAO.requisicaoId, (l) => { l.campos_json = '{"nome":"Nome Revisado"}'; }, formato);
    assert.equal(pulso.listarProdutos().erro.codigo, 'DADOS_INCONSISTENTES');
  });

  test(`alteração pendente com valor forjado não é concluída (payload ${formato})`, () => {
    const { pulso, armazenamento } = ambienteComProduto();
    armazenamento.falharNaProxima('PRODUTOS_ALTERACOES', 'antes');
    assert.equal(pulso.alterarProduto(ALTERACAO).ok, false);
    forjarLinha(armazenamento, 'PRODUTOS_ALTERACOES', ALTERACAO.requisicaoId, (l) => { l.campos_json = '{"nome":"Nome Forjado"}'; }, formato);
    assert.equal(pulso.reconciliarPendencias().erro.codigo, 'DADOS_INCONSISTENTES');
    assert.equal(armazenamento.tabelas.PRODUTOS_ALTERACOES.length, 0);
  });

  test(`ajuste pendente sem saldo anterior não é concluído (payload ${formato})`, () => {
    const { pulso, armazenamento } = ambienteComProduto();
    pulso.registrarEntrada(ENTRADA);
    const ajuste = { requisicaoId: 'REV-AJU', sku: 'MER-001', quantidadeContada: 4, motivo: 'Contagem fictícia' };
    armazenamento.falharNaProxima('MOVIMENTOS_ESTOQUE', 'antes');
    assert.equal(pulso.ajustarPorContagem(ajuste).ok, false);
    forjarLinha(armazenamento, 'MOVIMENTOS_ESTOQUE', ajuste.requisicaoId, (l) => { l.saldo_anterior = null; l.delta_unidades = 4; }, formato);
    assert.equal(pulso.reconciliarPendencias().erro.codigo, 'DADOS_INCONSISTENTES');
    assert.equal(armazenamento.tabelas.MOVIMENTOS_ESTOQUE.length, 1);
  });
}

test('novo lançamento não começa se a pendência continuar aberta depois de concluída', () => {
  const { carregarNucleo } = require('../local/nucleo');
  const pendente = { operacaoId: 'OPR-P', requisicaoId: 'REV-P', tipo: 'ENTRADA', registros: [{ tabela: 'MOVIMENTOS_ESTOQUE', linha: { movimento_id: 'MOV-P' } }], referenciaId: 'MOV-P', tentativas: 1 };
  const gravadas = [];
  const r = carregarNucleo().operacoes.executar({
    lock: { executar: (fn) => fn() }, relogio: () => '2026-11-18T12:00:00.000Z', gerarId: (p) => `${p}-T`,
    repositorio: { existe: () => true, anexarVerificado: (t, l) => gravadas.push(l),
      carregarEstado: () => ({ pendentes: [pendente], operacoesPorRequisicao: new Map() }) },
  }, { tipo: 'ENTRADA', normalizar: () => ({ ok: true, dados: {} }), assinatura: (d) => d,
    verificar: () => { throw new Error('não deveria validar o novo lançamento'); } }, { requisicaoId: 'REV-NOVA' });
  assert.equal(r.erro.codigo, 'RECONCILIACAO_PENDENTE');
  assert.equal(gravadas.filter((l) => l.requisicao_id === 'REV-NOVA').length, 0);
});

test('esquema recusa texto em coluna de inteiro opcional e aceita nulo', () => {
  const { carregarNucleo } = require('../local/nucleo');
  const { pulso, armazenamento } = ambienteComProduto();
  pulso.registrarEntrada(ENTRADA);
  const esquema = carregarNucleo().esquema;
  const linha = armazenamento.tabelas.MOVIMENTOS_ESTOQUE[0];
  assert.equal(esquema.problemaLinha('MOVIMENTOS_ESTOQUE', linha), null);
  assert.match(esquema.problemaLinha('MOVIMENTOS_ESTOQUE', { ...linha, custo_unit_centavos: '600' }), /custo_unit_centavos/);
  assert.equal(esquema.problemaLinha('MOVIMENTOS_ESTOQUE', { ...linha, custo_unit_centavos: null }), null);
});

test('última alteração do histórico também não pode gerar versão inválida do produto', () => {
  const { pulso, armazenamento } = ambienteComProduto();
  const alterar = (requisicaoId, campos) => assert.equal(pulso.alterarProduto({ ...ALTERACAO, requisicaoId, campos }).ok, true);
  alterar('REV-A1', { estoqueAlvo: 30 });
  alterar('REV-A2', { estoqueMinimo: 20 });
  alterar('REV-A3', { estoqueMinimo: 6 });
  alterar('REV-A4', { estoqueAlvo: 10 });
  anteciparOperacao(armazenamento, 'REV-A3', 'REV-A2');
  anteciparOperacao(armazenamento, 'REV-A4', 'REV-A2');
  assert.equal(pulso.listarProdutos().erro.codigo, 'DADOS_INCONSISTENTES');
});
