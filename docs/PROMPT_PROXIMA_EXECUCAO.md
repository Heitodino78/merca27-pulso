# Prompt para a próxima execução — PULSO

Estado de referência: M-03 concluída localmente em 19/11/2026 na branch `m03-operacoes` (a partir de `interface-angular`). M-06 continua sem verificação em navegador real. Este arquivo descreve a execução seguinte; ainda não foi executado.

**Antes de iniciar a sessão (ação do proprietário):** a verificação em navegador foi bloqueada nas duas execuções anteriores (D-047, D-054). Para concluí-la, autorize um destes caminhos: executar o Firefox do sistema via `flatpak-spawn --host`, executar um Chromium baixado em `/tmp`, ou abrir a sessão dentro do Maestri com o CLI `maestri` disponível. Sem isso, as etapas de navegador ficam registradas como impossíveis e a execução segue com o restante.

```text
# MERCA 27 — PULSO — FASE 2: VENDAS COM VÁRIOS ITENS E ESTORNO (E M-06 NO NAVEGADOR, SE AUTORIZADO)

Você é o engenheiro responsável pelo PULSO, sistema de gestão de um mercado inteiramente fictício. Trabalhe diretamente nos arquivos, teste e documente. Apresente um plano curto e execute sem esperar confirmação para decisões técnicas rotineiras.

## 1. LEITURA OBRIGATÓRIA

Leia integralmente:
- docs/RELATORIO_M03.md, docs/RELATORIO_INTERFACE.md, docs/PROGRESSO.md, docs/DECISOES.md (especialmente D-002, D-027, D-031, D-040 a D-054) e docs/TESTES.md.
- docs/MELHORIAS_PLANEJADAS.md.
- Os cinco documentos-base (v1.1.0). Para esta fase importam sobretudo: Documento Mestre seções 9, 13, 14 e 15 (jornada de venda, regras não negociáveis, KPIs e exemplo); docs/03 seções 4.3 e 4.4 (VENDAS e ITENS_VENDA), 6.2 (confirmarVenda), 6.5 (estornarVenda), 8.1 e 8.2 (receita e CMV), 9 (códigos de erro), 12.1 (T05 a T11, T15, T18 e T19) e 12.3 (reconciliações); docs/04 Fase 2. Não altere os documentos-base; registre divergências em docs/DECISOES.md. As divergências já conhecidas estão em D-054.
- README.md, interface/README.md, fixtures/SEED_README.md e todo o código em src/, local/, tipos/, tests/ e interface/src/.

Confirme o estado real pelo código e pelos comandos. Em caso de divergência, o código e os testes executados prevalecem sobre este prompt.

## 2. ESTADO REAL

- Branch m03-operacoes, com commits locais por fatia; sem merge em main, remoto ou publicação.
- Núcleo src/ em scripts globais var PULSO, sem build e sem APIs do Node (D-002, D-027). Portas: armazenamento { ler, anexar }, lock { executar }, relogio e gerarId.
- Protocolo: intenção PENDENTE com payload { registros: [{ tabela, linha }, ...] } -> cada registro com releitura e comparação completa -> CONFIRMADA. Reconciliação grava só o que falta; operação confirmada precisa ter todos os registros; linha só vale se constar, igual, na lista da sua operação; referencia_id é a chave do primeiro registro (D-049 a D-051). O formato { tabela, linha } da Fase 01 é legível só para os sete tipos antigos.
- Tipos de operação: CADASTRO_FORNECEDOR, CADASTRO_PRODUTO, ALTERACAO_PRODUTO, ENTRADA, SALDO_INICIAL, PERDA, AJUSTE e CONTAGEM_INVENTARIO (vários AJUSTE, tudo ou nada; só pela CLI, D-052).
- Tabelas: FORNECEDORES, PRODUTOS, PRODUTOS_ALTERACOES, MOVIMENTOS_ESTOQUE e OPERACOES_LOG. PULSO.movimento.TIPOS já prevê VENDA e ESTORNO, sem uso.
- Idempotência por requisicaoId, REQUISICAO_CONFLITANTE, reconciliação automática antes de novo lançamento, consultas sem trava com uma repetição sob trava. Saldo sempre derivado.
- Interface Angular 22.3.0 + Tailwind 4.3.5 em interface/ (D-040 a D-046), um único HTML de cerca de 395 KiB, despacho com 14 ações (D-044), chave por tentativa lógica (D-045). Pré-visualização em local/servidor-preview.js (127.0.0.1, --seed, --falhas-simuladas).
- Testes: 421 na raiz, 39 na interface. Mutações: 134 no núcleo e 13 na interface (resultados em docs/TESTES.md). fixtures/base-fase01/ prova a compatibilidade e não pode ser editada.
- Pendente: M-06 no navegador (360, 390, 768 e 1440 px, capturas em docs/capturas/). Google sem acesso efetivo (D-048).

## 3. AMBIENTE E LINHA DE BASE

1. Preserve alterações locais. Confira Git e branch; crie a branch fase-02-vendas a partir de m03-operacoes. Sem merge ou push.
2. Node/npm podem não estar no PATH. Foi usado /tmp/merca27-runtime/node-v22.23.5-linux-x64/bin. Se a pasta não existir, baixe o Node 22 oficial para /tmp e confira o SHA-256 antes de extrair. Nada global.
3. Volume vfat com showexec: nenhum binário roda a partir dele. Mantenha bin-links=false, instale a interface com npm run interface:instalar e use os scripts da raiz (D-042).
4. Antes de alterar, execute npm ci, npm test, npm run check, npm run typecheck, npm run demo, npm run interface:typecheck, npm run interface:test, npm run interface:build e npm run mutacao -- --verificar-alvos. Meça com npm run medir e guarde em docs/evidencias/ como "antes".
5. Rode npm run mutacao (cerca de uma hora) e npm run interface:mutacao nos marcos e no fim, sem outra carga pesada ao mesmo tempo: medições e mutações em paralelo distorcem tempos. Alvos ausentes, erros de compilação contados como detecção ou sobreviventes sem justificativa são falhas. Ao refatorar, rode --verificar-alvos e reescreva alvos com o mesmo efeito. Se um teste novo ler arquivos fora de src/, local/, tests/, fixtures/ e interface/src/, inclua-os na cópia de local/mutacao.js. Ao mudar a forma de dados internos, revise os testes que montam repositórios ou operações falsas: em M-03, dois deles passaram a acertar pelo motivo errado e esconderam MUT-08 e MUT-09. Testes de falha devem conferir a mensagem ou a causa, não só o código.
6. Commits com identidade por comando: git -c user.name="PULSO Dev" -c user.email="dev@merca27.invalid" commit.
7. Nunca apague nem migre silenciosamente bases anteriores. Novas tabelas precisam conviver com bases das Fases 01 e M-03: uma base sem as abas novas deve ser lida como tendo zero vendas. Use PULSO_DADOS temporário nos testes.

## 4. ETAPA 1: M-06 NO NAVEGADOR (SÓ SE AUTORIZADO)

Verifique os três caminhos sem contornar bloqueios. Se algum funcionar, cumpra a seção 4 do prompt anterior, que está registrada em docs/RELATORIO_INTERFACE.md: capturas nas quatro larguras, jornadas, falhas simuladas, teclado e movimento reduzido. Se nenhum funcionar, registre e siga. Repita a verificação ao fim da etapa 3, para as telas de venda.

## 5. ETAPA 2: VENDAS NO NÚCLEO (FASE 2)

### 5.1 Modelo
- Novas tabelas, com colunas em ordem fixa em src/infra/esquema.js: VENDAS (venda_id, operacao_id, requisicao_id, registrado_em, forma_pagamento, total_centavos, custo_est_centavos, observacao, operador_simulado) e ITENS_VENDA (item_id, venda_id, operacao_id, sku, quantidade, preco_unit_centavos, custo_unit_est_centavos, subtotal_centavos). Ajuste os nomes se o código pedir, registrando em DECISOES.
- Não grave estado mutável na linha da venda (o armazenamento só acrescenta): "estornada" é derivado da existência do estorno.
- Movimentos tipo VENDA com delta negativo, preço e custo capturados no momento da venda e referência à venda.
- Pontos que precisam conhecer as tabelas novas (todos, ou linhas de venda ficam sem conferência): TABELAS em src/infra/esquema.js; TABELAS_DE_DADOS, a leitura em carregarEstado, as chamadas de conferirOrigem, o mapa linhasPorTabela da checagem de presença e a lista de tipos em dobrarOperacoes (src/infra/repositorio.js); conferirIntencao, com reconstrução própria para VENDA e ESTORNO_VENDA; a reprodução cronológica; e o armazenamento em memória de tests/apoio.js (local/medir-desempenho.js já lê as tabelas do esquema). TIPOS_LEGADOS não muda: tipos novos só usam o formato atual.
- Cada tabela nova acrescenta uma leitura por consulta (hoje são 5). Meça e registre o efeito; não troque releituras de verificação por cache para compensar.

### 5.2 confirmarVenda (operação VENDA)
- Pedido: requisicaoId, itens [{ sku, quantidade }] (1 a 50), formaPagamentoFicticia (DINHEIRO, PIX ou CARTAO, só informativa), observacao opcional sem dados pessoais, operador simulado. Sem descontos.
- SKU repetido no pedido: decida entre agregar e recusar (T09) e registre em DECISOES. A contagem recusa repetição; prefira coerência, salvo motivo melhor.
- Dentro da trava: idempotência, saldo atual de cada item, produto existente e ativo (T10). Qualquer item inválido ou sem saldo recusa a venda inteira (T06, T07), com SALDO_INSUFICIENTE indicando o SKU e o saldo.
- Uma operação grava, nesta ordem: a venda, os itens e um movimento VENDA por item, usando o M-03. Total = Σ(quantidade × preço capturado); custo estimado = Σ(quantidade × custo de referência vigente) (docs/03 seções 8.1 e 8.2, T15). Alteração posterior de preço não muda a venda (T11).
- A validação da intenção e a reprodução cronológica devem reconstruir venda, itens e movimentos pelas regras de domínio e conferir as relações: itens da venda, movimentos dos itens, Σ subtotais = total, Σ custos = custo estimado e saldo nunca negativo (docs/03 seção 12.3).

### 5.3 estornarVenda (operação ESTORNO_VENDA)
- Estorno total, uma única vez por venda, com motivo obrigatório: grava o registro do estorno (por exemplo, tabela ESTORNOS_VENDA) e um movimento ESTORNO por item, devolvendo as unidades ao estoque. Não apaga nem edita a venda.
- Simplificação do protótipo, a documentar: todo estorno devolve as unidades como revendáveis. Estorno parcial e item não revendável ficam fora (docs/03 seção 6.5).
- Repetir o mesmo estorno é idempotente; um segundo estorno da mesma venda, com outra chave, é recusado (VENDA_JA_ESTORNADA). Estorno de venda inexistente é recusado.
- Se houver tempo depois das demais fatias, avalie a reversão compensatória de perda e ajuste adiada em D-031. Senão, registre que continua adiada.

### 5.4 Consultas
- listarVendas (período opcional, mais recentes primeiro, com estado derivado), consultarVenda por venda_id ou requisicaoId com itens e movimentos.
- consultarEstoque passa a mostrar os movimentos VENDA e ESTORNO. Nenhum KPI ou dashboard nesta fase: receita e margem por período ficam para a Fase 3.

### 5.5 Testes do núcleo
- T05 a T11, T15, T18 e T19 do docs/03, com os valores do exemplo do Documento Mestre seção 15.
- Falhas antes, depois e silenciosas em cada posição da lista de registros da venda e do estorno; repetição conclui sem duplicar; nada de venda incompleta em saldo, listagem ou consulta.
- Adulteração: item removido, extra ou alterado, total divergente, movimento de venda sem item, estorno duplicado, venda estornada com movimento faltando.
- Concorrência real com processos: duas vendas acima do saldo disputando o mesmo SKU (só uma é aceita), a mesma venda disparada várias vezes (uma gravação) e estornos concorrentes da mesma venda (um aceito).
- Compatibilidade: fixtures/base-fase01/ e uma base gerada pelo código de M-03 continuam legíveis.
- Mutações novas para cada regra de venda e estorno.

## 6. ETAPA 3: VENDAS NA INTERFACE E NA CLI

- CLI: venda --item MER-001=2 --item MER-002=1 --pagamento PIX; vendas; venda --id; estorno --venda ID --motivo "...".
- Despacho: exponha confirmarVenda, listarVendas, consultarVenda e estornarVenda. Atualize o teste da lista de ações e o shim.
- Interface (mesmas regras de D-041 a D-046): tela de venda com vários itens (busca de produto, quantidade, preço capturado exibido em BRL, total calculado só para conferência visual, o valor oficial vem do núcleo), revisão antes de confirmar, histórico de vendas com busca por ID e detalhe com estorno. Mesma chave por tentativa lógica, os estados vazio, carregando, sucesso, falha incerta, conflito e pendente, e clique duplo bloqueado.
- Opcional: tela de contagem de inventário; se fizer, exponha registrarContagem no despacho.
- Testes de componente e mutações de interface para as telas novas.

## 7. FORA DESTA EXECUÇÃO

Dashboard, KPIs por período, despesas, automações periódicas, lotes e validade, descontos, estorno parcial, cadastro de fornecedor pela interface e pagamentos reais. Google só com acesso efetivo e autorizado para executar Apps Script, seguindo D-048. Não simule integração concluída.

## 8. ENTREGA

Conclua cada fatia com testes antes de cada commit local. Não publique, não envie ao remoto e não exponha credenciais. Use somente dados fictícios.

Atualize README.md, docs/PROGRESSO.md, docs/DECISOES.md, docs/TESTES.md, docs/MELHORIAS_PLANEJADAS.md e docs/RELATORIO_INTERFACE.md (navegador, se houver). Crie docs/RELATORIO_FASE_02.md com arquivos, comandos, resultados, compatibilidade com bases anteriores, desempenho antes e depois, limitações e situação real do Google. Reescreva este prompt para a Fase 3 (dashboard e automações) com base no que existir. Se algum critério não puder ser cumprido, registre o que falta sem marcar a funcionalidade como concluída.

COMECE AGORA pela leitura, pela linha de base e pelo plano curto; depois siga as etapas em ordem.
```
