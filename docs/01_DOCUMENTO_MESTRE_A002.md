---
title: "A-002 — MERCA 27 / Documento Mestre"
project: "Agência Digital / Plano A / Projeto A-002"
status: "Planejado — código não iniciado"
version: "1.0.0"
date: "2026-11-18"
source_of_truth: true
tags: [a002, merca27, documento-mestre, estoque, financeiro, automacao]
---

# A-002 — MERCA 27 | DOCUMENTO MESTRE

> **Fonte principal de produto.** Este documento governa o conceito, o cenário simulado, os objetivos, o design, o escopo e a definição de sucesso. Consulte `02_PESQUISA_MERCADO_E_OPERACAO.md` para justificativas externas e `03_ARQUITETURA_DADOS_E_TESTES.md` para as regras técnicas. Atualize o registro de decisões a cada mudança relevante.
>
> **Estado de implementação:** nenhum código foi implementado. Não confundir documento planejado com produto concluído.

---

## PARTE I — Contexto e tese do projeto

### 1. Origem no portfólio da agência

O A-001, **BRASA 47**, foi desenvolvido como demonstração de site gastronômico com Angular e experiência de pedido e foi encerrado pelo criador como projeto local de portfólio, sem publicação. Agora o **A-002** deve demonstrar uma competência **diferente**: automação de processos, consistência dos dados, regras de negócio, indicadores úteis e organização de rotinas empresariais.

Este projeto pertence ao **Plano A — Soluções Digitais para Negócios**, e não ao Plano B de edição/distribuição de vídeos. A meta aqui não é construir uma interface imponente vazia; é demonstrar que conseguimos transformar um problema operacional em um fluxo confiável.

### 2. Empresa fictícia escolhida — DECIDIDO

**Nome de trabalho:** MERCA 27 — Mercado de Bairro.  
**Setor:** pequeno comércio varejista de conveniência e alimentos embalados.  
**Formato:** uma única loja fictícia, sem filiais, vendas presenciais registradas manualmente.  
**Canal principal:** balcão; sem e-commerce, marketplace, delivery integrado ou emissão fiscal.  
**Estilo de atendimento:** proximidade, rapidez, sortimento pequeno e boa reposição.

**Missão fictícia da empresa:** facilitar a compra cotidiana de itens essenciais do bairro, com disponibilidade previsível, atendimento claro e operação enxuta.

**Promessa do software PULSO:** "Menos planilhas confusas. Mais clareza sobre o que entrou, vendeu, faltou e precisa ser reposto." Essa promessa significa **organização e visibilidade**, nunca aumento garantido de lucro.

A escolha do setor é uma decisão de projeto, não uma conclusão de que mercadinhos sejam o segmento mais rentável do Brasil. O diagnóstico de rupturas, perdas, fornecedores e giro é apoiado por materiais do Sebrae (ver pesquisa).

### 3. O que a MERCA 27 deve representar

1. **Rotina plausível:** chegada de mercadorias, conferência, venda, perda/avaria, contagem e fechamento de dia.
2. **Dono sobrecarregado:** precisa saber rapidamente o que comprar e o que vendeu.
3. **Riscos mensuráveis:** falta de mercadoria, estoque parado, validade próxima, erros de lançamento e divergências.
4. **Limitações realistas:** pouco tempo para cadastrar dados, sem equipe de TI, orçamento reduzido.
5. **Experiência clara:** um operador não precisa ser especialista em fórmulas para registrar uma venda.
6. **Transparência:** métricas, custos e dados da loja são todos **sintéticos**.

### 4. Cenário simulado (valores de design, não pesquisa de mercado)

| Dimensão | Hipótese de demonstração |
|---|---|
| Operação | 1 unidade fictícia |
| Usuários simulados | Proprietário/gestor, operador de caixa e repositor |
| Catálogo inicial | 40 produtos fictícios (`SKU`s), expansível para 60 |
| Categorias | Bebidas, mercearia, laticínios, snacks, higiene, limpeza |
| Fornecedores | 6 fornecedores inventados |
| Histórico de testes | 90 dias de dados sintéticos coerentes |
| Venda | Composta por 1 ou vários itens, com ID único |
| Métodos de pagamento | Dinheiro, Pix e cartão como **campos informativos**, sem integração bancária |
| Estoque | Unidade inteira por SKU no MVP; sem venda fracionada |
| Validade | Marcada em lotes selecionados; FEFO é evolução posterior |
| Moeda/fuso | BRL; datas no fuso America/Sao_Paulo |
| Contas reais | Nenhuma |

As quantidades acima são **parâmetros de projeto** para testar volume e variedade. Não apresentam dados médios de lojas reais.

### 5. Problemas de negócio que o software resolve

| ID | Problema da operação | Solução demonstrável | Prova de funcionamento |
|---|---|---|---|
| D01 | Produto acaba sem aviso | Saldo e ponto de reposição por SKU | Alerta aparece quando cruza o limite |
| D02 | Entrada e venda ficam em cadernos distintos | Histórico único de movimentos | Saldo é reconcilável com lançamentos |
| D03 | Gestor confunde vender muito com lucrar | Receita, CMV estimado, margem bruta e despesas separados | Indicadores batem com casos de teste |
| D04 | Erro de digitação distorce estoque | Formulários e validações de domínio | Operação inválida é rejeitada |
| D05 | Mercadoria vence/perde valor | Registro de perdas e validade futura | Perdas afetam estoque e relatórios |
| D06 | Compras são feitas por impressão | Sugestão simples baseada em mínimo-alvo | Lista de reposição auditável |
| D07 | A mesma venda é registrada duas vezes | Chave idempotente e confirmação | Segunda submissão não duplica baixa |
| D08 | Números não inspiram confiança | Dashboard reconciliável | É possível rastrear cada KPI até dados |

### 6. O que não estamos dizendo

- Que um mercadinho fictício possui receita, CNPJ ou clientes verdadeiros.
- Que o sistema substitui software fiscal, PDV, contador ou ERP profissional.
- Que dados sintéticos provam economia de tempo ou crescimento financeiro.
- Que planilhas são ideais para toda escala de negócio.
- Que qualquer usuário pode operar o sistema sem treinamento ou controles de acesso.

---

## PARTE II — Público, jornadas e requisitos de produto

### 7. Personas simuladas

**Rafa — proprietário(a)/gestor(a) fictício(a):** verifica vendas, alertas e necessidades de reposição; tem poucos minutos por dia para analisar dados. Não deve depender de conhecimento técnico.

**Dani — operador(a) fictício(a):** registra vendas e consulta produtos; precisa de confirmação clara para evitar registros em duplicidade.

**Lu — repositor(a) fictício(a):** registra entradas e perdas, realiza contagens e identifica produtos abaixo do estoque mínimo.

*Essas personas são hipóteses de design, não entrevistas reais.*

### 8. Jornada principal 1 — Reposição

`Gestor abre painel → enxerga alerta de estoque baixo → consulta SKU e fornecedor → visualiza sugestão de quantidade → compra simulada fora do sistema → registra entrada → novo saldo é recalculado → alerta desaparece se condição resolvida.`

**Critérios:** não permitir quantidade negativa; nunca calcular saldo apenas por edição de célula; registrar quando e por qual motivo a entrada ocorreu.

### 9. Jornada principal 2 — Venda

`Operador busca produto → informa unidades → adiciona itens → revisa preço e total → confirma venda → estoque é baixado → venda entra no histórico → KPIs são atualizados.`

**Critérios:** validar disponibilidade antes de confirmar; não deixar estoque negativo; não duplicar uma venda após clique repetido; manter visão legível para o operador.

### 10. Jornada principal 3 — Perda e ajuste

`Repositor localiza produto → escolhe motivo (avaria/vencimento/quebra/contagem) → informa quantidade → recebe confirmação → saldo e indicador de perdas são atualizados.`

**Critérios:** motivo obrigatório; operação reversível por lançamento compensatório com registro, não apagando histórico. Para divergência de contagem, registrar o saldo contado e gerar movimento de ajuste auditável.

### 11. Jornada principal 4 — Fechamento gerencial

`Gestor escolhe período → vê receita de vendas, custo estimado de mercadoria vendida, margem bruta, perdas e alertas → abre detalhamento de um indicador → identifica produtos críticos → registra ação de reposição.`

Não confundir **receita de vendas** com **entrada de dinheiro em caixa** nem **margem bruta** com **lucro líquido**. Despesas e pagamentos entram em fase própria, com datas e conceitos separados.

### 12. Funcionalidades por prioridade

| Prioridade | Módulo | Escopo mínimo | Fora do mínimo |
|---|---|---|---|
| P0 | Produtos | SKU único, nome, categoria, custo, preço, mínimo, ativo | Fotos, múltiplas tabelas de preço |
| P0 | Movimentos | Entrada, venda, perda e ajuste auditáveis | Integração com fornecedor |
| P0 | Vendas | Itens, quantidades, descontos inicialmente não permitidos, ID único | NFC-e, integração com terminal |
| P0 | Estoque | Saldo derivado e alerta de reposição | Previsão por ML |
| P0 | Dashboard | Receita, itens vendidos, saldo, alertas, margem bruta estimada | BI avançado |
| P1 | Fornecedores | Cadastro básico fictício e vínculo com SKU | Gestão de contratos |
| P1 | Alertas | Lista diária de baixo estoque e resumo opcional | Disparo automático por WhatsApp |
| P1 | Despesas | Registro gerencial segregado | Contabilidade integral |
| P1 | Importação | CSV sintético com validação e relatório de rejeições | Sincronização com ERP |
| P2 | Validade por lote | Vencimentos e alertas | Rastreabilidade legal de alimentos |
| P2 | Gestão de compras | Sugestões e pedidos simulados | Compra eletrônica real |
| Futuro | Multiusuário real | Autenticação e políticas de acesso | Não implementar agora |

**MVP essencial:** produtos + movimentos + venda + estoque + dashboard mínimo. Fornecedores e alertas automatizados podem ser segunda entrega.

### 13. Regras de negócio não negociáveis

1. Valores em **centavos inteiros** para operações de receita, custo e despesa.
2. Estoque em unidades inteiras positivas ou zero no MVP.
3. Saldo **derivado** de estoque inicial auditável e movimentos confirmados; nunca um número sobrescrito silenciosamente.
4. Toda operação tem ID único e data de registro; reversões referenciam a transação original.
5. Toda venda deve conter ao menos um item; todos os SKUs devem estar ativos e existentes.
6. Venda que excede saldo disponível deve ser rejeitada sem alterar parte da operação.
7. Entrada sem fornecedor pode ser permitida como ajuste inicial explicitamente rotulado; entrada regular deve referenciar fornecedor quando módulo disponível.
8. Lançamentos duplicados, IDs inválidos, `NaN`, quantidades decimais, strings indevidas e preços negativos devem falhar com mensagem compreensível.
9. Baixas e vendas precisam de processamento serializado quando houver risco de concorrência.
10. Produtos desativados não podem receber novas vendas, mas precisam continuar visíveis no histórico.
11. Valores históricos de venda devem preservar **preço praticado na transação**, sem serem reescritos quando o cadastro muda.
12. Relatórios devem informar filtros e período; não misturar totais por competência e caixa.
13. Perdas e ajustes devem aparecer separadamente de vendas.
14. Ações destrutivas devem ser substituídas, sempre que possível, por estorno/reversão rastreável.

### 14. Indicadores do primeiro painel

| KPI | Fórmula conceitual | Interpretação/limitação |
|---|---|---|
| Receita bruta de vendas | Soma de totais de vendas confirmadas no período, menos estornos se houver | Não é recebimento líquido nem lucro |
| Unidades vendidas | Soma de quantidades de itens vendidos | Não é número de clientes |
| Número de vendas | Contagem de IDs de venda confirmados | Não confundir com itens |
| Ticket médio | Receita de vendas / quantidade de vendas (se >0) | Não indica margem |
| CMV gerencial estimado | Soma de quantidades × custo capturado na venda | Não é laudo contábil |
| Margem bruta estimada | Receita − CMV gerencial estimado | Antes de despesas e tributos |
| Margem bruta % | Margem bruta / receita (se >0) | Quando receita zero, exibir N/D |
| SKUs abaixo do mínimo | Contagem de ativos com saldo < ou = nível de alerta conforme política | Limiar configurável |
| Valor do estoque estimado | Unidades atuais × custo de referência documentado | Não equivale a avaliação contábil oficial |
| Perdas em unidades/valor | Soma das baixas classificadas como perda, com custo estimado | Aproximação gerencial |

**Decisão crítica:** preço de venda e custo histórico são gravados nos itens da transação. Para o MVP, usar **custo gerencial vigente no momento da venda** como aproximação; contabilização formal de CMV por método de custeio, devoluções e impostos deve ser analisada separadamente.

### 15. Exemplo de decisão operacional demonstrativa

- SKU MER-014 possui saldo 3, mínimo 5 e alvo 12 unidades.
- A lista de compras mostra `repor 9 unidades` (= alvo 12 − saldo 3), antes de considerar encomendas em trânsito.
- Após entrada de 9 unidades, saldo volta a 12 e o alerta é removido.
- Se uma venda de 4 unidades ocorrer quando o saldo for 3, a venda completa é rejeitada.

**Importante:** todos os números do exemplo são inventados para demonstrar as regras.

---

## PARTE III — Identidade e experiência da MERCA 27

### 16. Separar marca da empresa e marca do sistema

**MERCA 27** — negócio fictício. Sua identidade é de mercado de bairro próximo, acessível, limpo e confiável.

**PULSO** — ferramenta operacional. Sua identidade é de produto B2B claro, confiável, objetivo e elegante; não deve imitar um app bancário com métricas falsas nem um dashboard genérico de IA.

O design não precisa compartilhar a estética escura/gastronômica da BRASA 47. Esse projeto deve demonstrar **versatilidade da agência**.

### 17. Direção de design — DECIDIDO como hipótese visual inicial

- **Personalidade:** utilitária, editorial, moderna, calorosa, sóbria.
- **Base:** superfícies claras, textos carvão, acento verde-petróleo e tom âmbar reservado a alertas.
- **Paleta proposta (ajustável mediante contraste):** `#F5F5F0` fundo; `#1B2725` texto; `#17685B` ação principal; `#DCA44C` atenção; `#DCEAE4` destaque sutil; `#FFFFFF` superfícies.
- **Tipografia:** títulos com personalidade discreta; corpo prioritariamente funcional. Estudar uma família de interface como `Inter` ou `Manrope` e uma display complementar, sem excesso de fontes.
- **Visualização:** números grandes com contexto, sparklines só quando úteis, rótulos completos, filtros visíveis, tabelas legíveis; cores nunca como única forma de comunicar estado.
- **Layout:** desktop otimizado para operação; responsivo para revisão no celular. Não forçar uma interface complexa de lançamento a ser realizada por microcontroles mobile.
- **Motion:** feedback breve na confirmação, destaque de alerta, transições leves; respeitar movimento reduzido.
- **Originalidade:** marca, composição, ícones e linguagem específicos da MERCA 27; evitar template de três KPIs coloridos sem significado.

### 18. Páginas/abas-alvo

1. **Visão Geral:** receita, vendas, alertas e estoque em risco.
2. **Produtos:** cadastro, consulta, busca e status.
3. **Movimentações:** entrada, perda e ajuste.
4. **Vendas:** registro e histórico.
5. **Estoque:** saldo atual, mínimo e reposição sugerida.
6. **Relatórios:** filtro temporal, produtos mais movimentados e exportação simples.
7. **Configurações:** parâmetros de demonstração, sem dados pessoais.

**Observação técnica:** no MVP essas áreas podem ser abas de Google Sheets e um menu próprio de Apps Script, sem necessariamente uma aplicação web separada. A lista é mapa funcional, não obrigação de sete telas completas imediatamente.

### 19. Regras de UX

- Nunca exigir que o usuário edite fórmulas para lançar vendas.
- Reduzir campos obrigatórios ao necessário; explicar unidade e preço em BRL.
- Confirmar gravação apenas quando houver sucesso real no armazenamento.
- Exibir erros com a causa e a possível correção.
- Evitar confirmação dupla silenciosa; bloquear reenvio ou usar ID de ação.
- Não esconder mudanças de estoque em segundo plano.
- Deixar filtros e período dos relatórios explícitos.
- Em tabelas, permitir busca, congelamento de cabeçalho e destaque consistente de problemas.
- Projetar estados: vazio, carregando, sucesso, falha, conflito e sem permissão.

---

## PARTE IV — Fases, qualidade e limites

### 20. Roadmap por entregas

**Fase 0 — Fundação:** organização do projeto, ambiente local, planilha-base de teste, entidades e conjunto inicial de produtos sintéticos.

**Fase 1 — Estoque auditável:** cadastro + entrada/ajuste/perda + saldo derivado e testes. Deve existir uma jornada ponta a ponta funcional.

**Fase 2 — Vendas:** venda com múltiplos itens, verificação de saldo, idempotência, histórico e reversão básica.

**Fase 3 — Inteligência operacional:** painel e alertas de baixo estoque; automação programada com limites claros.

**Fase 4 — Refino:** despesas gerenciais opcionais, exportação, usabilidade, documentação, performance e case de portfólio.

**Futuro condicionado à validação:** lotes/validade/FEFO, compras, mais controles de acesso, sistema web independente, multi-loja, IA para previsão de demanda.

### 21. Definição de pronto

Uma funcionalidade só está concluída quando:

1. Fluxo de usuário demonstrado com dados fictícios.
2. Regras matemáticas e estados inválidos cobertos por testes apropriados.
3. Dados gravados de modo auditável, com ID e rastreabilidade.
4. Erros e permissões tratados com mensagens claras.
5. Ao menos um caso de borda testado (duplicidade, esgotamento, valor inválido).
6. Design utilizável e coerente com a identidade.
7. Documentação de comandos, evidência de testes e limites atualizada.
8. Nenhuma alegação de integração/monitoramento inexistente.

### 22. Segurança e privacidade

- **Somente dados sintéticos** no protótipo; sem CPF, telefone ou endereço reais.
- Verificar permissões da planilha e do Apps Script; compartilhar pelo princípio do menor privilégio.
- Evitar edição direta das tabelas de movimentos; limitar por interface e permissões, reconhecendo os limites de proteção da planilha.
- Não guardar tokens ou senhas em código, arquivos ou planilhas expostas.
- Se um cliente real vier a ser considerado no futuro, revisar LGPD, segurança, backup, auditoria, operações financeiras e adequação às ferramentas antes de usar dados reais.
- Google Sheets/Apps Script não devem ser anunciados como ERP completo nem como banco transacional de alta concorrência.

### 23. Fora do escopo inicial

- Emissão fiscal (NFC-e/NF-e), SPED, obrigações acessórias, contabilidade formal.
- Terminal de pagamento ou cobrança Pix real.
- Controle sanitário/regulatório completo, rastreabilidade legal de alimentos.
- WhatsApp Business API e notificações massivas.
- Controle de funcionários e folha de pagamento.
- CRM com dados reais de consumidores.
- App público, login próprio, banco remoto, multi-tenant, integrações de terceiros pagas.
- Previsão por IA, sugestão automática de compra sem revisão humana.

### 24. Riscos principais

| Risco | Consequência | Prevenção no escopo |
|---|---|---|
| Desenvolver tudo de uma vez | Projeto incompleto | MVP e fases estritas |
| Estoque calculado por células editáveis | Saldo inconsistente | Log imutável e funções de domínio |
| Vendas concorrentes | Saldo negativo/duplicado | Lock + validação + idempotência |
| Confundir métricas | Decisões erradas | Nomes e fórmulas explícitos |
| Fórmulas quebradas por operador | Painel inválido | Interface de entrada e proteção limitada |
| Dependência de limites do Google | Falhas de automação | Cotas, logs, alertas e reprocessamento |
| Excesso de visualização | Lento e difícil | Primeiro números corretos, depois design |
| Dados falsos tratados como reais | Engano no portfólio | Aviso permanente de demonstração |
| Complexidade de lotes | Cronograma explode | Adiar FEFO ao pós-MVP |

### 25. Decisões arquiteturais (ADR iniciais)

| ID | Estado | Decisão | Justificativa |
|---|---|---|---|
| A002-ADR-001 | DECIDIDO | Cliente fictício é mercado de bairro único | Combina estoque, vendas, reposição e perdas |
| A002-ADR-002 | DECIDIDO | Produto se chama PULSO (nome interno) | Diferencia cliente e solução |
| A002-ADR-003 | DECIDIDO | Google Sheets + Apps Script no MVP | Barreira baixa e automações demonstráveis |
| A002-ADR-004 | DECIDIDO | Histórico de movimentos como fonte de saldo | Auditabilidade |
| A002-ADR-005 | DECIDIDO | Centavos e unidades inteiras | Exatidão das regras básicas |
| A002-ADR-006 | DECIDIDO | Dados 100% sintéticos | Segurança e transparência de portfólio |
| A002-ADR-007 | DECIDIDO | Sem integração fiscal/pagamento real | Escopo controlado |
| A002-ADR-008 | PLANEJADO | Interface de lançamento sem editar células críticas | UX e integridade |
| A002-ADR-009 | PLANEJADO | Logs, idempotência e bloqueio concorrente | Minimizar duplicidades |
| A002-ADR-010 | PLANEJADO | Validade por lote posterior | Evitar modelo incompleto e enganoso |

### 26. Questões ainda abertas

- Interface inicial: sidebar HTML Service do Apps Script ou formulários/menus na própria planilha? Proposta: começar com menu+formulário simples; decidir após primeiro protótipo.
- O melhor método gerencial de custo para vendas e estoque, além do custo corrente de referência: decidir antes de relatório de margem avançado.
- Publicação: não planejada, seguindo o uso local/pessoal do portfólio A-001.
- Nome MERCA 27/PULSO: são nomes de projeto, não validados para registro de marca.
- Nível de detalhamento de lotes e validade: validar após MVP.

### 27. Registro do status real

- [x] Setor e empresa fictícia selecionados.
- [x] Requisitos e pesquisa de base elaborados.
- [x] Escopo, arquitetura e fases propostos.
- [ ] Dados fictícios gerados e revisados.
- [ ] Planilha-base criada.
- [ ] Código implementado.
- [ ] Testes executados.
- [ ] Interface auditada.
- [ ] Case de portfólio concluído.

### 28. Próxima ação

Siga `04_ROTEIRO_EXECUCAO_E_PROMPT.md`: abra o diretório do A-002 no VS Code/Codex/Claude Code, leia os quatro documentos e inicie **somente a Fase 0 e a primeira fatia funcional de estoque**. Não avançar para dashboard antes de provar que o saldo é correto.
