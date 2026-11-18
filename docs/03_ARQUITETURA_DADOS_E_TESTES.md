---
title: "A-002 — Arquitetura Técnica, Dados e Estratégia de Testes"
project: "MERCA 27 / PULSO"
status: "Especificação proposta — não implementada"
version: "1.0.0"
date: "2026-11-18"
tags: [arquitetura, apps-script, google-sheets, dados, testes, regras-de-negocio]
---

# A-002 — Arquitetura, dados, operações e testes

> **Princípio de engenharia:** o PULSO não é uma planilha em que se altera manualmente o saldo. É um pequeno sistema de **operações com histórico rastreável**, cujos dados são armazenados em Google Sheets e processados por Apps Script no protótipo. Apps Script + Sheets é uma escolha de aprendizagem/portfólio, não compromisso de adequação para alto volume ou uso fiscal.

## 1. Objetivos técnicos

1. Demonstrar domínio de modelagem de entidades e regras de negócio em um ambiente de automação acessível.
2. Tornar impossível, pelo fluxo suportado, confirmar venda sem estoque suficiente.
3. Permitir auditoria de cada alteração de saldo, desde uma posição inicial conhecida.
4. Lidar com ações duplicadas, entradas inválidas e falhas de script.
5. Manter métricas e relatórios reconciliáveis com os registros de origem.
6. Evitar dependências pagas, APIs comerciais ou permissões excessivas na versão inicial.
7. Escrever código organizado, testável, tipado quando for viável e com histórico de alterações.

## 2. Proposta de arquitetura lógica

```text
                 OPERADOR / GESTOR (fictício)
                           |
              Menu + formulário/Sidebar
                           |
                 Apps Script Controller
                           |
                    Validação de caso
                           |
          +----------------+----------------+
          |                                 |
    Serviços de domínio               Queries de leitura
    - entrada                         - saldo por SKU
    - venda                           - indicadores
    - perda/ajuste                    - alertas
          |                                 |
          +---------- Repositórios ---------+
                           |
                     Google Sheets
          [Produtos] [Vendas] [ItensVenda]
          [Movimentos] [Fornecedores] [Logs]
                           |
                   Dashboard/Relatórios
```

**Camadas:** UI apenas coleta inputs e exibe feedback; controladores convertem requests; domínio valida e calcula; repositório lê/grava; planilha guarda os registros; relatórios projetam valores calculados. Evitar lógica crítica espalhada em fórmulas de células, `onEdit` e funções de interface ao mesmo tempo.

## 3. Ferramentas — decisão inicial

- **Google Sheets:** armazenamento demonstrativo, visão tabular e painéis.
- **Google Apps Script:** ações controladas, formulários, automações e validação de fluxos.
- **JavaScript moderno:** linguagem de execução do Apps Script; considerar TypeScript com build apenas se beneficiar a manutenção, não como requisito de início.
- **`clasp` + Git local:** editar scripts de modo versionável, quando autorizado e disponível.
- **Node.js (opcional):** testes locais de funções puras; não exigir implantação de servidor.
- **Python (opcional):** preparar CSV e fixtures sintéticas, sem acoplamento obrigatório.
- **Google Forms/HTML Service (opcional):** avaliar interface mínima antes de construir um frontend separado.
- **Sem WhatsApp API, backend novo ou banco remoto no MVP.**

Documentação oficial: Sheets em Apps Script (https://developers.google.com/apps-script/guides/sheets); boas práticas (https://developers.google.com/apps-script/guides/support/best-practices); `clasp` (https://developers.google.com/apps-script/guides/clasp).

## 4. Abas de dados: esquema lógico proposto

Os nomes são referenciais; a implementação pode ajustar nomes com migração documentada. As linhas são registros com cabeçalhos fixos. Não editar IDs ou totais históricos manualmente.

### 4.1. `PRODUTOS`

| Campo | Tipo | Regras |
|---|---|---|
| `sku` | string | Identificador único, estável, ex. MER-001 |
| `nome` | string | 3–120 caracteres |
| `categoria_id` | enum/string | Categoria cadastrada |
| `unidade` | string | `UN` no MVP |
| `preco_venda_centavos` | int | >= 0; normalmente > 0 em produto ativo |
| `custo_ref_centavos` | int | >= 0; estimativa gerencial |
| `estoque_minimo` | int | >= 0 |
| `estoque_alvo` | int | >= estoque_minimo |
| `fornecedor_id` | string/null | Referência opcional em fase 1 |
| `ativo` | boolean | Produto desativado mantém histórico |
| `criado_em` | datetime | Timestamp local + ISO armazenável |
| `atualizado_em` | datetime | Registrar última alteração |

**Importante:** saldo não é campo de verdade em `PRODUTOS`. Se exibido para conveniência, é cache/retrato derivado.

### 4.2. `MOVIMENTOS_ESTOQUE`

| Campo | Tipo | Regras |
|---|---|---|
| `movimento_id` | string | UUID/ID único |
| `operacao_id` | string | Liga movimentos originados na mesma venda/entrada |
| `sku` | string | SKU existente |
| `tipo` | enum | `SALDO_INICIAL`, `ENTRADA`, `VENDA`, `PERDA`, `AJUSTE`, `ESTORNO` |
| `delta_unidades` | int | Assinado; zero rejeitado |
| `motivo` | string | Obrigatório em perda/ajuste/estorno |
| `referencia_id` | string/null | Venda ou entrada origem |
| `registrado_em` | datetime | Data/hora de processamento |
| `operador_simulado` | string | Ex.: OPERADOR-DEMO (não conta real) |

**Invariante:** `saldo(sku) = soma(delta_unidades)` para movimentos válidos daquele SKU. Não confiar em saldo cacheado na hora da confirmação de venda.

### 4.3. `VENDAS`

| Campo | Tipo | Regras |
|---|---|---|
| `venda_id` | string | Único |
| `requisicao_id` | string | Chave idempotente única fornecida pela UI/controlador |
| `registrado_em` | datetime | Timestamp de confirmação |
| `estado` | enum | `CONFIRMADA`, `ESTORNADA`; `PENDENTE` se necessário à estratégia de gravação |
| `forma_pagamento` | enum/string | Dinheiro/Pix/Cartão como **informação fictícia** |
| `total_centavos` | int | Soma dos itens confirmados |
| `custo_est_centavos` | int | Soma dos custos gerenciais por item |
| `observacao` | string/null | Opcional e sem dados pessoais |

### 4.4. `ITENS_VENDA`

| Campo | Tipo | Regras |
|---|---|---|
| `item_id` | string | Único |
| `venda_id` | string | Refere venda existente |
| `sku` | string | Produto válido na data |
| `quantidade` | int | >0 |
| `preco_unit_centavos` | int | Valor capturado na venda |
| `custo_unit_est_centavos` | int | Custo gerencial capturado na venda |
| `subtotal_centavos` | int | `quantidade × preco_unit_centavos` |

**Não atualizar preços históricos** quando o cadastro do produto mudar posteriormente.

### 4.5. `FORNECEDORES` (P1)

`fornecedor_id`, `nome_ficticio`, `categoria_principal`, `prazo_estimado_dias` (hipótese), `ativo`. Sem telefones, e-mails, CNPJs ou endereços reais.

### 4.6. `OPERACOES_LOG`

`operacao_id`, `requisicao_id`, `tipo`, `estado`, `registrado_em`, `resumo`, `referencia_id`, `erro_cod`, `tentativas`. Objetivo: rastrear confirmação, falha e reprocessamento. Não registrar segredos, dados pessoais ou dumps completos de objetos indiscriminadamente.

### 4.7. `DESPESAS` (fase posterior)

`despesa_id`, `descricao`, `categoria`, `valor_centavos`, `competencia`, `data_pagamento`, `status`. Não somar automaticamente a receita para inventar lucro sem conceito financeiro explícito.

### 4.8. `CONFIGURACOES`

`chave`, `valor`, `tipo`, `descricao`. Ex.: moeda `BRL`, fuso `America/Sao_Paulo`, faixa de alertas configurável, versão de esquema.

## 5. Dados sintéticos e consistência

### 5.1. Seed planejado (não gerado)

- 40 SKUs inventados e distribuídos nas 6 categorias propostas.
- 6 fornecedores fictícios com IDs `FOR-001` ... `FOR-006`.
- 90 dias simulados com pelo menos uma venda multi-itens por dia útil modelado (volume exato a definir pelo gerador).
- Exemplos deliberados de estoque mínimo, ruptura evitada, perda e divergência de contagem.
- Nenhum nome comercial, código de barras real, CNPJ, endereço, documento ou telefone necessário.
- Valores de compra/venda são **números para teste**, não cotação de mercado ou sugestão comercial.

### 5.2. Regras de geração

1. Gerar IDs únicos e datas consistentes.
2. Garantir que venda de itens não supere estoque disponível na ordem temporal dos registros válidos.
3. Criar casos de borda em fixtures separadas para testes de rejeição, não poluir a história confirmada com vendas impossíveis.
4. Ter tabela de saldos inicial e final reconciliáveis.
5. Fornecer `SEED_README.md` descrevendo parâmetros, aleatoriedade e resultados esperados.
6. Gerador idealmente determinístico por seed, reproduzível após reset.

## 6. Casos de uso e regras de gravação

### 6.1. `registrarEntrada(request)`

Entrada: `requisicaoId`, `sku`, `quantidade`, `referenciaFornecedor`, `motivo?`.

Validações: SKU válido e ativo, quantidade inteira >0, requisição não duplicada, fornecedor se exigido. Saída: `operacaoId`, `movimentoId`, novo saldo calculado. Gravar log. Sem atualização direta de campo de saldo.

### 6.2. `confirmarVenda(request)`

Entrada: `requisicaoId`, `itens[{sku, quantidade}]`, `formaPagamentoFicticia`.

Procedimento lógico:

1. Validar estrutura do pedido e agregação de SKUs repetidos.
2. Obter lock adequado ao contexto.
3. **Dentro do lock**, checar idempotência pela `requisicaoId` e consultar saldos atuais.
4. Rejeitar venda inteira se qualquer item for inválido/insuficiente.
5. Capturar preço/custo correntes de referência para o registro histórico.
6. Preparar registros de venda, itens e deltas de estoque.
7. Executar estratégia de gravação controlada com estados de operação e detecção/recuperação de gravações parciais.
8. Registrar sucesso somente após confirmação das escritas e consistência mínima.
9. Liberar lock em `finally` e devolver ID/resultado.

**Atenção crítica:** operações em múltiplas abas **não são transações ACID**. A implementação deve escolher uma estratégia explícita de integridade, por exemplo um log de operações com estados e mecanismo de reconciliação; não prometer rollback automático. Se houver falha parcial, bloquear repetição cega, registrar `PENDENTE_RECONCILIACAO` e permitir reprocessamento idempotente após inspecionar o estado.

### 6.3. `registrarPerda(request)`

Entrada: `requisicaoId`, `sku`, `quantidade`, `motivo`. Validar saldo suficiente, gravar delta negativo, registrar categoria de perda. Não contabilizar como venda.

### 6.4. `ajustarPorContagem(request)`

Entrada: `requisicaoId`, `sku`, `quantidadeContada`, `motivo`. Calcular delta = contado − teórico; registrar `AJUSTE` com saldo anterior/novo para auditoria. Rejeitar entrada de quantidade negativa. Evitar ajuste zero desnecessário.

### 6.5. `estornarVenda(request)` — P1/fase 2

Não apagar venda. Registrar estado e movimentos compensatórios vinculados ao original, uma única vez. Definir claramente o caso de devolução física: estorno financeiro e devolução ao estoque podem divergir se o item não for revendável. No protótipo, documentar simplificação.

## 7. Regras de reposição

### 7.1. Política simples do MVP

Definir `alerta = saldo <= minimo`; `sugestao = max(0, alvo - saldo)` **quando o alerta estiver ativo**. Pode haver política alternativa de `< mínimo`, mas escolha uma única e teste-a.

Exemplo: mínimo 5, alvo 12, saldo 3 → alerta, sugestão 9. Saldo 5 → alerta se política `<=`. Não esconder a condição escolhida.

### 7.2. Evolução futura

Ponto de pedido por consumo esperado × lead time + estoque de segurança, com dados reais suficientes e documentação de premissas. Sem recomendações automáticas de compra no MVP. Validade e lote exigem submodelo próprio e devem ser adiados.

## 8. Fluxo financeiro sem ambiguidades

### 8.1. Receita de venda

`total_da_venda = Σ(quantidade × preco_unit_centavos)` para itens confirmados, com valores históricos.

### 8.2. CMV estimado gerencial

`cmv_est = Σ(quantidade × custo_unit_est_centavos)` capturado no momento da venda. É um **indicador de gestão simplificado**, não custeio contábil formal de inventário por lote ou custo médio móvel.

### 8.3. Margem bruta estimada

`margem_bruta = receita_de_vendas − cmv_est`; `margem_pct = margem_bruta/receita` se receita >0; caso contrário `N/D`.

### 8.4. Despesas e caixa

A fase posterior deve distinguir despesas por competência, pagamento por caixa e receita registrada versus recebimento. Não derivar saldo bancário de vendas fictícias sem conta de recebimentos/pagamentos. Eventuais taxas de cartão, tributos e perdas têm tratamentos separados antes de falar em lucro líquido.

## 9. Confiabilidade e tratamento de erros

| Código de erro | Caso | Resposta/ação |
|---|---|---|
| `SKU_INEXISTENTE` | Produto não cadastrado | Corrigir SKU e não gravar |
| `SKU_INATIVO` | Produto descontinuado | Impedir nova venda |
| `QTD_INVALIDA` | Zero, negativa, decimal, NaN | Corrigir quantidade |
| `SALDO_INSUFICIENTE` | Venda maior que disponível | Mostrar saldo, não gravar venda |
| `OPERACAO_DUPLICADA` | Requisição já concluída | Devolver operação anterior sem duplicar |
| `LOCK_OCUPADO` | Concorrência | Avisar e permitir tentar novamente sem criar nova chave |
| `FALHA_GRAVACAO` | Escrita parcial | Marcar para reconciliação, não confirmar sucesso |
| `SEM_PERMISSAO` | Operador sem acesso adequado | Não executar, mostrar instrução segura |
| `LIMITE_APPS_SCRIPT` | Cota/execução interrompida | Registro e tentativa controlada depois |
| `DADOS_INCONSISTENTES` | Itens/venda/movimentos não reconciliam | Bloquear novas ações dependentes até correção |

**Observação:** textos e códigos são uma convenção de projeto. Não são mensagens padronizadas do Google.

## 10. Segurança e controle de acesso

- Somente contas controladas para o laboratório; sem links públicos com edição.
- Separar claramente **abas de entrada** de tabelas de histórico e fórmulas protegidas, reconhecendo que a proteção de célula não é barreira de segurança suficiente contra editores com poder total.
- Não inserir tokens em arquivos versionados; usar configuração adequada ao ambiente e verificar compartilhamento.
- Evitar deploy público de web app; qualquer publicação exigirá revisão de identidade de execução e escopos de autorização.
- Minimizar permissões do script; evitar solicitar Gmail/Drive além do necessário para a fase.
- Logs devem evitar dados pessoais e apresentar erro sem expor detalhes internos.
- Cópias de segurança e exportações precisam de procedimento documentado; recuperar falha de gravação antes de executar novas transações.
- Se no futuro houver dados reais, fazer avaliação de requisitos legais, LGPD, autenticação, backups e integridade antes de uso; o MVP **não é pronto para produção empresarial**.

Fontes: ANPD https://www.gov.br/anpd/pt-br/centrais-de-conteudo/materiais-educativos-e-publicacoes/guia-orientativo-sobre-seguranca-da-informacao-para-agentes-de-tratamento-de-pequeno-porte ; suporte Google a proteção de intervalos https://support.google.com/docs/answer/1218656 ; LockService https://developers.google.com/apps-script/reference/lock .

## 11. Cotas, triggers e desempenho

- Consultar quotas vigentes antes de implementar automações que usam e-mail/tempo ou muitas leituras.
- Fazer leitura de blocos e `setValues` em lote, em vez de dezenas de `getValue`/`setValue` por célula.
- Não depender de `onEdit` para criar movimentos quando scripts atualizam dados programaticamente.
- Triggers temporais para relatórios podem falhar; registrar última execução e erro.
- Alarmes devem ser idempotentes, especialmente em reexecução: não enviar duas notificações para o mesmo evento/período.
- Limitar tamanho de seed e volumes de demonstração para o ambiente da conta utilizada.
- Se a aplicação começar a precisar de alta concorrência/volume, reavaliar arquitetura antes de ampliar o uso.

Fontes oficiais: https://developers.google.com/apps-script/guides/support/best-practices ; https://developers.google.com/apps-script/guides/services/quotas ; https://developers.google.com/apps-script/guides/triggers ; https://developers.google.com/apps-script/guides/triggers/installable .

## 12. Estratégia de testes

### 12.1. Testes de domínio (locais quando possível)

| ID | Cenário | Esperado |
|---|---|---|
| T01 | SKU novo válido | Cadastro aceito, ID único |
| T02 | SKU repetido | Rejeitar duplicado |
| T03 | Quantidade 0/-1/1.5/NaN | Rejeitar sem escrever |
| T04 | Entrada +10 em saldo 0 | Saldo 10 |
| T05 | Venda 3 após entrada de 10 | Saldo 7 e 1 venda |
| T06 | Venda 8 com saldo 7 | Rejeitada; saldo permanece 7 |
| T07 | Venda com dois itens, um insuficiente | Nenhum item baixado |
| T08 | Repetir mesma `requisicao_id` | Exatamente uma operação confirmada |
| T09 | Itens repetidos no request | Agregar ou rejeitar conforme política explícita |
| T10 | Produto inativo | Nova venda rejeitada; histórico preservado |
| T11 | Preço de venda alterado após venda | Venda histórica mantém preço original |
| T12 | Perda 2 em saldo 7 | Saldo 5; perda ≠ venda |
| T13 | Contagem física 4 com saldo 5 | Ajuste -1, motivo e histórico |
| T14 | Limite de reposição | Alerta e sugestão corretos em 0, mínimo e acima do mínimo |
| T15 | Receita e CMV | Valores em centavos e margem coerente |
| T16 | Ticket médio com 0 vendas | `N/D`, sem divisão por zero |
| T17 | ID de produto ausente | Rejeitar de forma clara |
| T18 | Falha de escrita simulada | Não declarar confirmação; marcar reconciliação |
| T19 | Lock concorrente | Não gravar duas vendas acima do saldo |
| T20 | Gerar seed novamente | Resultado determinístico, sem duplicação inesperada |

### 12.2. Testes de interface

- Cadastro → entrada → venda → consulta de saldo.
- Botões: não aceitar segundo clique durante envio; resposta idempotente mesmo se enviado.
- Mensagens de erro específicas e acessíveis.
- Histórico de vendas e busca por ID.
- Dashboard por período com indicadores rastreáveis.
- Planilha sem fórmulas expostas para edição casual no fluxo principal.
- Layout legível a 360, 390, 768 e 1440 px, se houver HTML Service/visual web.
- Confirmação de ação não acontece antes da gravação real.

### 12.3. Testes de dados e reconciliação

- `Σ(movimentos.sku) == saldo(sku)` para cada SKU.
- `Σ(itens_venda.subtotal) == vendas.total` por venda.
- `Σ(delta de tipo VENDA) == -Σ(quantidade de itens de vendas confirmadas)` por SKU, respeitando estornos.
- Toda venda confirmada tem itens, movimentos esperados e chaves únicas.
- Requisições repetidas não criam linhas adicionais.
- Saldos nunca ficam negativos no histórico validado.
- Dashboard para um período combina com consulta independente do mesmo período.

### 12.4. Evidências e rastreabilidade

Registrar em `docs/TESTES.md`: data, comando, ambiente, resultado, casos, limitações e correções. Capturas de interface em `docs/capturas/` se realmente geradas. **Não afirmar teste de integração Google, trigger ou browser sem executá-lo.**

## 13. Estrutura-alvo de arquivos

```text
A002-MERCA27/
├── docs/
│   ├── 00_COMECE_AQUI.md
│   ├── 01_DOCUMENTO_MESTRE_A002.md
│   ├── 02_PESQUISA_MERCADO_E_OPERACAO.md
│   ├── 03_ARQUITETURA_DADOS_E_TESTES.md
│   ├── 04_ROTEIRO_EXECUCAO_E_PROMPT.md
│   ├── DECISOES.md                # criar durante a implementação
│   ├── PROGRESSO.md               # criar durante a implementação
│   └── TESTES.md                  # criar quando houver testes executados
├── src/
│   ├── domain/                   # regras puras (JS/TS)
│   ├── application/              # casos de uso
│   ├── infra/                    # Sheets, locks, logs, gatilhos
│   └── ui/                       # menu, sidebar/formulários
├── fixtures/                      # dados 100% sintéticos
├── scripts/                       # ferramentas locais opcionais
├── README.md
└── package.json                   # somente se testes/build locais exigirem
```

Não criar diretórios vazios nem arquivos desnecessários na primeira sessão. A estrutura precisa se adaptar às limitações de `clasp` e à integração escolhida, sem perder separação conceitual.

## 14. Registro de decisões técnicas em aberto

- **T-01:** interface: Sidebar HTML Service ou formulários simples; validar por protótipo.
- **T-02:** estratégia detalhada de commit/reconciliação de múltiplas abas, dado que Sheets não tem transação ACID.
- **T-03:** método de custo gerencial (custo de referência capturado ou custo médio): MVP simplificado; documentar antes do dashboard.
- **T-04:** lock de documento ou script conforme o contexto de execução.
- **T-05:** fuso e formato de timestamp sem ambiguidades de locale.
- **T-06:** qual método de implantação/teste local de Apps Script é viável com as contas disponíveis.
- **T-07:** preferências de proteção da planilha e quem seria editor na demonstração.

Cada decisão deve ter contexto, alternativas, escolha, consequência e validação.

## 15. Definição técnica de pronto do MVP

Uma venda confirmada altera estoque exatamente uma vez, sem permitir saldo negativo; uma entrada aumenta estoque; uma perda reduz estoque e fica classificada; o dashboard mostra valores rastreáveis; um usuário consegue completar os fluxos sem tocar em células de dados críticas; as verificações documentadas passam no ambiente em que foram realmente executadas; e nenhuma função simula integração externa inexistente.
