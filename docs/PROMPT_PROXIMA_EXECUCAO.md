# Prompt para a próxima execução — A-002 / PULSO

Copie o bloco abaixo e execute na raiz do projeto, em uma nova sessão.

Estado de referência: releitura completa do repositório em 18/11/2026. A interface visual (M-06), a integração Google e as operações com vários registros (M-03) ficam para as execuções seguintes.

```text
# MERCA 27 — PULSO
## PROMPT MASTER DE DESENVOLVIMENTO — FASE 01
### Fundação do modelo, Estoque e Integridade

# 1. SUA FUNÇÃO

Você é o engenheiro principal do PULSO, sistema de gestão da MERCA 27, um mercado de bairro inteiramente fictício. Trabalhe diretamente nos arquivos do projeto: implemente, teste, corrija e documente. Não entregue apenas plano ou sugestões.

Você tem autonomia para decisões técnicas dentro deste escopo, desde que sejam testadas e registradas em docs/DECISOES.md. Apresente um plano curto e comece a implementar sem aguardar confirmação.

# 2. ESTADO REAL DO PROJETO

Verificado por releitura e execução em 18/11/2026. Confirme tudo antes de alterar qualquer arquivo. Se houver divergência, o código e os testes executados prevalecem sobre este prompt.

- Branch atual: fase-00. Existe main com os documentos-base. Não há remoto.
- A revisão da Fase 00 está NÃO COMMITADA: 11 arquivos modificados, mais tests/integridade.test.js e fixtures/SEED_README.md sem rastreamento.
- 130 testes aprovados no Node 22.23.5 e no Node 24.22.3. Sintaxe válida em 23 arquivos. Demo aprovada.
- Casos de uso existentes: cadastrarProduto, registrarEntrada, consultarEstoque, listarProdutos e reconciliarPendencias.
- Protocolo de escrita: PENDENTE -> dado -> CONFIRMADA, em src/application/operacoes.js.
- Portas: armazenamento { ler, anexar }, lock { executar }, relogio e gerarId.
- src/ roda como scripts globais (var PULSO), sem APIs do Node, para ser portável ao Apps Script.
- Catálogo sintético atual: 6 SKUs, semente 27.

Ainda NÃO existem: M-01 a M-07, fornecedores, saldo inicial, perda, ajuste, reposição, vendas, dashboard, interface visual e integração Google.

# 3. LEITURA OBRIGATÓRIA

Leia integralmente, nesta ordem:

1. docs/MELHORIAS_PLANEJADAS.md
2. docs/RELATORIO_FASE_00.md, docs/PROGRESSO.md, docs/DECISOES.md e docs/TESTES.md
3. docs/00_COMECE_AQUI.md até docs/04_ROTEIRO_EXECUCAO_E_PROMPT.md
4. README.md, fixtures/SEED_README.md e todo o código em src/, local/ e tests/

O Documento Mestre é a referência de produto e o documento 03 define os contratos técnicos. Não altere os cinco documentos-base. Registre divergências em docs/DECISOES.md.

# 4. ESCOPO

## Dentro desta execução

M-07, M-01, M-02, M-04 e M-05, fornecedores, catálogo de 40 SKUs, saldo inicial, perda, ajuste por contagem e reposição sugerida.

## Fora desta execução

- M-06 (interface visual) e integração com Google Sheets ou Apps Script.
- M-03 (vários registros por operação), que antecede a Fase 2.
- Vendas, estorno, dashboard, automações periódicas, lotes e validade.
- Compra automática. A reposição é apenas uma sugestão para revisão humana.

O Documento Mestre prevê reversão de perdas e ajustes por lançamento compensatório. Ela depende do estorno: registre em docs/DECISOES.md que fica adiada para a Fase 2.

# 5. RESTRIÇÕES JÁ COMPROVADAS NESTE AMBIENTE

Foram testadas nesta máquina. Não gaste tempo redescobrindo.

1. Node e npm não estão no PATH. Use /tmp/merca27-runtime/node-v22.23.5-linux-x64/bin se existir. Caso contrário, baixe o Node 22 oficial de nodejs.org para uma pasta temporária e confira o SHA-256 com SHASUMS256.txt antes de extrair. Não instale nada globalmente.
2. O projeto está em um volume vfat, sem links simbólicos. "npm install" padrão FALHA. Crie um .npmrc no projeto com bin-links=false.
3. TypeScript 7 FALHA neste volume com EACCES, porque o binário nativo não pode ser executado. Use exatamente typescript@5.9.3 e @types/node@22.20.5, apenas como dependências de desenvolvimento.
4. Sem links em node_modules/.bin, execute o compilador com: node node_modules/typescript/lib/tsc.js
5. Sem identidade Git configurada, não altere a configuração global. Use nos commits: git -c user.name="PULSO Dev" -c user.email="dev@merca27.invalid" commit

# 6. ORDEM DE EXECUÇÃO

Execute os blocos em ordem. Ao final de cada bloco, rode npm test, npm run check e npm run demo, corrija o que falhar e faça um commit local. Só avance com tudo aprovado.

## BLOCO 0 — Linha de base

1. Confira o ambiente e rode testes, sintaxe e demo no estado atual.
2. Commit, na branch fase-00, da revisão pendente, sem alterar seu conteúdo.
3. Crie a branch fase-01 a partir desse commit. Não faça merge em main nem envie nada para remoto.

## BLOCO 1 — Reforço da suíte de testes

Um teste de mutação sobre o código atual aplicou 42 defeitos deliberados: 31 foram detectados e 11 sobreviveram.

Crie local/mutacao.js, sem dependências, que aplique cada defeito em uma cópia temporária do projeto, nunca nos arquivos reais, e informe os sobreviventes. Adicione o comando npm run mutacao.

Crie testes que detectem estes defeitos hoje não cobertos:

1. Aceitar evento anexado depois de CONFIRMADA.
2. Aceitar duas operações com a mesma requisicao_id.
3. Aceitar movimento confirmado de SKU sem cadastro.
4. Não conferir referencia_id da intenção com a chave do registro.
5. Aceitar estado desconhecido no log quando erro_cod parecer válido.
6. Aceitar tipo de operação desconhecido no log, inclusive em evento REJEITADA.
7. Remover o fsync do adaptador JSONL.

Atenção: o teste "saldo negativo forjado com operação aparentemente válida é detectado" passa hoje pelo motivo errado. O log recusa o tipo PERDA antes de chegar à verificação de saldo negativo. Corrija isso no Bloco 6, com uma operação PERDA bem formada.

Para os demais sobreviventes (resposta sem estado confirmado, pendências na releitura final da reconciliação e movimento de tipo ou delta inválido), crie um teste ou documente em docs/TESTES.md por que o defeito é equivalente.

## BLOCO 2 — M-07: checagem de tipos

Cumpra os critérios de M-07, com estas definições:

- tsconfig.src.json: checkJs, noEmit, lib ES2020 e "types": [], para que qualquer uso de API do Node em src/ seja erro.
- tsconfig.local.json: checkJs, noEmit, module nodenext e "types": ["node"].
- npm run typecheck executa as duas configurações.
- Declarações de tipos ficam fora de src/, por exemplo em tipos/.

Linha de base medida com TypeScript 5.9.3 sem strict: 10 erros em src/ (o padrão var PULSO = PULSO || {} e a propriedade codigo em Error) e 3 em local/. Resolva as causas. Não use @ts-nocheck, nem @ts-ignore para esconder problema real. Ative strict se for viável; se não for, registre o motivo.

Versione o package-lock.json e atualize o README.

## BLOCO 3 — M-01 e fornecedores

Implemente juntos, para mudar o esquema de movimentos uma única vez.

Fornecedores:
- Tabela FORNECEDORES: fornecedor_id, nome_ficticio, categoria_principal, prazo_estimado_dias, ativo, criado_em, operacao_id.
- Casos de uso cadastrarFornecedor e listarFornecedores, usando o executor de operações.
- Códigos FORNECEDOR_INEXISTENTE, FORNECEDOR_INATIVO e FORNECEDOR_DUPLICADO.
- Nenhum telefone, e-mail, CNPJ ou endereço.
- fornecedorId informado em produto precisa existir.

Colunas finais a acrescentar em MOVIMENTOS_ESTOQUE, nesta ordem:
custo_unit_centavos (inteiro?), fornecedor_id (texto?), categoria_perda (texto?), saldo_anterior (inteiro?), saldo_novo (inteiro?).

Regras por tipo de movimento:

| Tipo | Delta | Custo unitário | Fornecedor | Motivo | Categoria | Saldos anterior/novo |
|---|---|---|---|---|---|---|
| SALDO_INICIAL | positivo | obrigatório | nulo | obrigatório | nula | nulos |
| ENTRADA | positivo | obrigatório | obrigatório | opcional | nula | nulos |
| PERDA | negativo | custo de referência vigente | nulo | obrigatório | obrigatória | nulos |
| AJUSTE | diferente de zero | custo de referência vigente | nulo | obrigatório | nula | obrigatórios |

Valide essas regras também na leitura do histórico.

Em registrarEntrada, torne obrigatórios custoUnitCentavos (inteiro >= 0; zero é bonificação) e fornecedorId. referenciaFornecedor continua opcional, como referência do documento. Não altere custo_ref_centavos automaticamente.

Ao adaptar os testes existentes, acrescente apenas os novos campos obrigatórios. Não remova nem afrouxe nenhuma asserção.

Atualize conferirIntencao e dobrarOperacoes em src/infra/repositorio.js. Eles aceitam hoje somente CADASTRO_PRODUTO e ENTRADA, e abrirIntencao permite somente duas tabelas. Amplie essas listas com validação equivalente para cada novo tipo. Nunca remova as verificações.

## BLOCO 4 — M-02: alteração e desativação de produto

Cumpra os critérios de M-02, com estas definições:

- Tabela PRODUTOS_ALTERACOES: alteracao_id, operacao_id, sku, campos_json, motivo, registrado_em, operador_simulado.
- campos_json guarda somente os campos alterados, em forma canônica.
- Campos alteráveis: nome, categoria, precoVendaCentavos, custoRefCentavos, estoqueMinimo, estoqueAlvo, fornecedorId e ativo. SKU e unidade são imutáveis.
- Casos de uso: alterarProduto, desativarProduto, reativarProduto e consultarHistoricoProduto.
- Código ALTERACAO_SEM_MUDANCA para alteração sem efeito.
- Toda regra e consulta deve usar o estado vigente derivado, inclusive atualizado_em.

## BLOCO 5 — M-04: reconciliação automática

Cumpra os critérios de M-04. Depois de concluir a pendência, recarregue o estado e só então valide o novo lançamento: a validação nunca pode usar saldo anterior à conclusão. Substitua o teste "operação interrompida bloqueia novos lançamentos até a reconciliação" por testes do novo comportamento, sem reduzir a cobertura. Registre que D-017 substituiu D-007.

## BLOCO 6 — Saldo inicial, perda e ajuste

registrarSaldoInicial:
- Só é aceito se o SKU ainda não tiver nenhum movimento confirmado. Caso contrário, retorne SALDO_INICIAL_INDEVIDO.

registrarPerda:
- Categorias: AVARIA, VENCIMENTO e QUEBRA.
- Quantidade inteira positiva e motivo obrigatório.
- Perda maior que o saldo retorna SALDO_INSUFICIENTE, sem alterar nada.
- Aceita produto inativo, pois o estoque físico ainda existe.

ajustarPorContagem:
- quantidadeContada inteira, zero ou positiva.
- delta = contado - saldo teórico, calculado dentro da trava.
- Diferença zero retorna AJUSTE_SEM_DIFERENCA, sem criar movimento.
- Registra saldo_anterior e saldo_novo.
- Aceita produto inativo.

Saldo e validações sempre dentro da trava. Corrija aqui o teste de saldo negativo forjado apontado no Bloco 1.

## BLOCO 7 — Reposição sugerida

Crie consultarReposicao, somente leitura:

- Alerta: produto ativo com saldo <= estoque mínimo.
- Sugestão: max(0, alvo - saldo).
- Retorne SKU, nome, saldo, mínimo, alvo, sugestão, fornecedor e a regra aplicada.
- Produto inativo não aparece.
- Registre a política em docs/DECISOES.md.

## BLOCO 8 — Catálogo de 40 SKUs

- 40 SKUs e 6 fornecedores fictícios, distribuídos nas 6 categorias, com gerador determinístico.
- Mantenha nome, preço, custo, mínimo e alvo de MER-001 a MER-006 exatamente como estão hoje. Acrescente os novos modelos ao final da lista.
- Não consuma números aleatórios para atribuir fornecedor: isso mudaria os valores gerados. Atribua por regra fixa.
- Crie um teste que fixe os valores atuais dos seis primeiros SKUs.
- A seed cadastra fornecedores antes dos produtos e continua idempotente.
- Atualize fixtures/SEED_README.md.

Adicione à CLI, sem regra de negócio: fornecedores, cadastrar-fornecedor, alterar-produto, desativar, reativar, saldo-inicial, perda, ajuste e reposicao.

## BLOCO 9 — M-05: desempenho

Executado por último para medir o esquema final. Registre em docs/DECISOES.md essa mudança de ordem, que continua antes da integração com o Sheets.

Cumpra os critérios de M-05, com local/medir-desempenho.js gerando dados sintéticos apenas em pasta temporária. Declare o volume usado e registre tempos de antes e depois em docs/TESTES.md. Não extrapole os resultados para o Google.

# 7. REGRAS INEGOCIÁVEIS

- Saldo é sempre derivado de movimentos confirmados; nunca é armazenado como verdade.
- Estoque nunca fica negativo em nenhum ponto do histórico.
- Valores em centavos inteiros e quantidades em unidades inteiras.
- Toda escrita passa pelo executor de operações, com idempotência, conflito de requisição, releitura e recuperação de falhas.
- O armazenamento continua somente com ler e anexar.
- src/ continua sem APIs do Node. Referências futuras a serviços do Google só podem ocorrer dentro de funções.
- Perdas e ajustes ficam separados de vendas e de entradas.
- Dados 100% sintéticos: sem marcas reais, códigos de barras, CNPJ, telefones ou endereços.
- Não enfraqueça, ignore nem apague testes para fazê-los passar. Mudança de comportamento aprovada exige teste equivalente ou mais rigoroso.
- Não publique nada, não envie a remotos e não exponha credenciais.
- Não declare como executado o que não foi executado.

# 8. TESTES OBRIGATÓRIOS

Além dos critérios de cada melhoria, cubra:

| Cenário | Esperado |
|---|---|
| Perda de 2 com saldo 7 | Saldo 5; aparece como perda, nunca como venda |
| Perda de 8 com saldo 7 | SALDO_INSUFICIENTE; saldo 7 e nenhum movimento novo |
| Contagem 4 com saldo 5 | Ajuste -1, com saldo anterior 5, novo 4 e motivo |
| Contagem 8 com saldo 5 | Ajuste +3 |
| Contagem igual ao saldo | AJUSTE_SEM_DIFERENCA; nenhum movimento novo |
| Saldo inicial repetido ou após entrada | SALDO_INICIAL_INDEVIDO |
| Saldo 3, mínimo 5, alvo 12 | Alerta e sugestão 9 |
| Saldo 5, mínimo 5, alvo 12 | Alerta e sugestão 7 |
| Saldo 6, mínimo 5, alvo 12 | Sem alerta |
| Saldo 0 | Alerta e sugestão igual ao alvo |
| Entrada de 9 sobre saldo 3, alvo 12 | Saldo 12 e alerta removido |
| Produto inativo abaixo do mínimo | Fora da reposição |
| Preço alterado | Histórico de versões preservado e valor vigente atualizado |
| Mesma requisição repetida, em cada novo caso de uso | Uma única operação confirmada |
| Mesma requisição com dados diferentes, em cada novo caso de uso | REQUISICAO_CONFLITANTE |
| Falha em cada etapa da gravação, em cada novo caso de uso | Sem sucesso falso; repetição aplica uma única vez |
| Perdas simultâneas em processos reais, somando mais que o saldo | Saldo nunca negativo |
| Adulteração de cada nova tabela | DADOS_INCONSISTENTES |
| Recálculo independente de todos os SKUs | Igual ao saldo consultado |

# 9. CRITÉRIOS DE CONCLUSÃO

A Fase 01 só está concluída quando:

1. Todos os blocos estiverem implementados, com critérios de aceite comprovados.
2. npm test, npm run check, npm run typecheck e npm run demo passarem.
3. npm run mutacao não deixar sobrevivente sem justificativa documentada.
4. Todos os saldos baterem com o histórico de movimentos.
5. Nenhuma ação inválida for confirmada.
6. A documentação refletir o estado real.

# 10. SE NÃO FOR POSSÍVEL TERMINAR TUDO

Pare ao fim de um bloco completo, com testes aprovados e commit feito. Não deixe bloco pela metade. Registre exatamente o que foi concluído e o que falta, e gere o prompt de continuidade a partir desse ponto.

# 11. ENTREGA FINAL

Atualize:

- README.md e fixtures/SEED_README.md
- docs/MELHORIAS_PLANEJADAS.md, marcando apenas o que foi realmente concluído
- docs/PROGRESSO.md, docs/DECISOES.md e docs/TESTES.md, com comandos e resultados reais

Crie docs/RELATORIO_FASE_01.md com resumo, funcionalidades, arquitetura, arquivos alterados, versões das ferramentas, testes e resultados, problemas encontrados, decisões, limitações, estado atual e próxima prioridade.

Reescreva docs/PROMPT_PROXIMA_EXECUCAO.md com base no estado real. A próxima execução prevista é M-06 (interface) e, somente com acesso autorizado para executar Apps Script, a integração com o Google. Depois vem M-03, seguida da Fase 2 (vendas).

COMECE AGORA: leia a documentação, confirme o estado real, apresente o plano curto e execute a partir do Bloco 0.
```
