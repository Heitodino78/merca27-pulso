# Melhorias planejadas — PULSO

**Status: aprovadas pelo proprietário em 18/11/2026; execução da Fase 01 em andamento.** Os itens concluídos têm evidência em `docs/TESTES.md`.

## Ordem de execução

| Ordem | ID | Melhoria | Momento | Situação |
|---|---|---|---|---|
| 1 | M-07 | Checagem de tipos | Bloco 2 da Fase 01 | [x] Concluída |
| 2 | M-01 | Custo unitário na entrada | Bloco 3 da Fase 01 | [x] Concluída |
| 3 | M-02 | Alteração e desativação de produto | Bloco 4 da Fase 01 | [x] Concluída |
| 4 | M-04 | Reconciliação automática | Início da Fase 1 | [ ] Pendente |
| 5 | M-05 | Desempenho e leituras sem trava | Antes da integração com o Sheets | [ ] Pendente |
| 6 | M-06 | Interface compatível com Apps Script | Depois de M-01 e M-02 | [ ] Pendente |
| 7 | M-03 | Operações com vários registros | Antes da Fase 2 (vendas) | [ ] Pendente |

Os dados de `data/` são sintéticos e descartáveis. Mudanças de esquema podem recriá-los, desde que isso fique registrado em `docs/DECISOES.md`.

---

## M-01 — Custo unitário na entrada

**Problema:** a entrada não guarda quanto foi pago. Esse histórico não pode ser recuperado depois e é necessário para decidir o método de custo (T-03).

**Alterações:**
- Tornar `custoUnitCentavos` obrigatório em `registrarEntrada`, como inteiro maior ou igual a zero. Zero representa bonificação.
- Adicionar a coluna `custo_unit_centavos` em `MOVIMENTOS_ESTOQUE`, com novo tipo de esquema `inteiro?`. O valor é obrigatório em `ENTRADA` e nulo nos tipos sem custo.
- Incluir o campo na assinatura de idempotência.
- Adicionar `--custo` ao comando `entrada` da CLI e atualizar a demonstração e o README.
- Não alterar `custo_ref_centavos` automaticamente. O método de custo continua em aberto.

**Critérios de aceite:**
- Custo ausente, negativo, decimal, `NaN` ou em texto é rejeitado sem criar movimento.
- A mesma requisição com custo diferente retorna `REQUISICAO_CONFLITANTE`.
- A consulta de histórico exibe o custo de cada entrada.

---

## M-02 — Alteração e desativação de produto

**Problema:** não há como mudar preço, custo de referência, limites ou status. Uma edição direta em `PRODUTOS` é corretamente tratada como adulteração.

**Alterações:**
- Manter a linha de `PRODUTOS` imutável, como registro de criação.
- Criar a tabela somente-acréscimo `PRODUTOS_ALTERACOES`, com `alteracao_id`, `operacao_id`, `sku`, os campos alterados, `motivo`, `registrado_em` e `operador_simulado`.
- Derivar o estado vigente aplicando as alterações confirmadas, em ordem, sobre o registro de criação.
- Criar os casos de uso `alterarProduto`, `desativarProduto` e `reativarProduto`, usando o executor de operações existente.
- Manter o SKU imutável e exigir motivo em toda alteração.

**Critérios de aceite:**
- Preço, custo, nome, categoria, mínimo e alvo podem mudar, e o histórico de versões continua consultável.
- O estado resultante é validado por inteiro, inclusive `alvo >= mínimo`.
- Alteração sem mudança real é rejeitada.
- Produto desativado não recebe entrada, continua visível e pode ser reativado.
- Idempotência, conflito, falha de gravação e adulteração têm testes também nesta tabela.

---

## M-03 — Operações com vários registros

**Problema:** o payload atual guarda um único `{ tabela, linha }`, e `conferirOrigem` assume um registro por operação. Uma venda precisa gravar venda, itens e movimentos.

**Alterações:**
- Mudar o payload para `{ registros: [{ tabela, linha }, ...] }`.
- Fazer `gravarNova` e `concluir` percorrerem a lista, gravando somente o que estiver faltando.
- Exigir que uma operação confirmada tenha todos os seus registros presentes.
- Fazer `conferirOrigem` aceitar apenas registros que constem na lista da operação.

**Critérios de aceite:**
- Uma falha simulada em cada posição da lista não anuncia sucesso, e a repetição conclui sem duplicar nada.
- Nenhum registro de operação incompleta compõe saldos ou relatórios.
- Registro extra ou ausente em operação confirmada resulta em `DADOS_INCONSISTENTES`.
- Os testes atuais de entrada e cadastro continuam aprovados.

---

## M-04 — Reconciliação automática

**Problema:** uma operação interrompida bloqueia todos os lançamentos até alguém executar `reconciliar` (D-007).

**Alterações:**
- Antes de um novo lançamento, ainda dentro da trava, concluir as pendências na ordem em que foram registradas.
- Prosseguir com o novo lançamento somente se todas forem concluídas.
- Se alguma não puder ser concluída, não gravar o novo lançamento e retornar `RECONCILIACAO_PENDENTE`.
- Manter o comando `reconciliar` e registrar no log que a conclusão foi automática.

**Critérios de aceite:**
- Após uma falha, o lançamento seguinte conclui a pendência e depois o próprio lançamento, cada um exatamente uma vez.
- Se a reconciliação falhar, nenhum dado novo é gravado.
- O teste `operação interrompida bloqueia novos lançamentos até a reconciliação` é substituído por testes do novo comportamento, sem reduzir a cobertura. A mudança deve ser citada em `docs/TESTES.md`.

---

## M-05 — Desempenho e leituras sem trava

**Problema:** cada operação relê todas as tabelas, inclusive várias vezes, e as consultas aguardam a trava de escrita.

**Atenção:** ler sem trava pode captar uma escrita em andamento e gerar um falso `DADOS_INCONSISTENTES`, pois a leitura de várias tabelas não é um retrato único.

**Alterações:**
- Criar um script de medição com volume sintético equivalente a 90 dias e registrar os tempos antes e depois em `docs/TESTES.md`.
- Evitar releituras desnecessárias da mesma tabela dentro de uma operação, sem abandonar a verificação após gravar.
- Fazer consultas sem trava. Se detectarem inconsistência, repetir uma vez dentro da trava antes de reportar o erro.

**Critérios de aceite:**
- Consultas simultâneas a escritas não produzem falso erro, comprovado por teste com processos reais.
- Adulteração real continua sendo detectada.
- O relatório informa tempos medidos e os limites conhecidos, sem extrapolar resultados locais para o Google.

---

## M-06 — Interface compatível com Apps Script

**Problema:** a CLI prova a lógica, mas não demonstra a experiência do produto no portfólio.

**Alterações:**
- Criar telas em HTML, CSS e JavaScript sem framework, compatíveis com HTML Service.
- Cobrir: lista de produtos, cadastro, alteração de produto, registro de entrada e consulta de saldo com histórico.
- Criar um servidor de pré-visualização local, acessível só em `127.0.0.1`, que simule `google.script.run` e chame os mesmos casos de uso.
- Aplicar a paleta do Documento Mestre, conferindo contraste. O âmbar `#DCA44C` deve ser usado como fundo ou destaque com texto escuro, nunca como texto sobre fundo claro.
- Gerar o `requisicaoId` por tentativa de envio e reutilizá-lo ao repetir após falha.

**Critérios de aceite:**
- Estados de vazio, carregando, sucesso, falha, conflito e operação pendente estão implementados.
- Clique duplo não duplica lançamentos, e o sucesso só aparece após a confirmação da gravação.
- Navegação por teclado, rótulos de formulário e `prefers-reduced-motion` são respeitados.
- A tela foi verificada em navegador real a 360, 390, 768 e 1440 px, com capturas em `docs/capturas/`.
- A documentação deixa claro que a pré-visualização local não é uma integração com o Google.

---

## M-07 — Checagem de tipos

**Problema:** o projeto só verifica a sintaxe. Erros de tipo em valores monetários e quantidades dependem apenas dos testes.

**Alterações:**
- Adicionar anotações JSDoc aos contratos principais: portas, requisições, respostas e linhas das tabelas.
- Adicionar `typescript` somente como dependência de desenvolvimento e o comando `npm run typecheck`, usando `checkJs` e `noEmit`.
- Não criar etapa de build nem converter o código para `.ts`.

**Critérios de aceite:**
- `npm run typecheck` termina sem erros em `src/` e `local/`.
- `src/` continua carregando sem APIs do Node.
- O README informa a nova dependência de desenvolvimento e quando executar `npm install`.
