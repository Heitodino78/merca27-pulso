---
title: "A-002 — Pesquisa de Mercado e Operação do Mercadinho"
project: "MERCA 27 / PULSO"
status: "Pesquisa documental concluída; entrevistas e validação empírica pendentes"
version: "1.1.0"
research_date: "2026-11-18"
updated: "2026-11-19"
tags: [pesquisa, sebrae, minimercados, estoque, processos, validacao]
---

# A-002 — Pesquisa profunda: o que um mercado pequeno precisa resolver

> **Método:** leitura de materiais institucionais do Sebrae, documentação técnica oficial do Google e recomendações da ANPD. Esta é uma pesquisa **documental**, não entrevista com lojistas nem levantamento estatístico de preços e adoção. Diferenciamos **[FONTE]** do que é **[HIPÓTESE DE PROJETO]** e **[DECISÃO]**. URLs e datas de acesso constam no final.

## 1. Pergunta central

**Que problemas operacionais uma pequena loja de bairro precisa resolver diariamente — e que podem ser demonstrados com um sistema leve de gestão e automação sem fingir que construímos um ERP?**

O interesse não é replicar módulos genéricos de grandes softwares, mas escolher um processo específico com demonstração verificável: **a mercadoria entra, vende, sai, pode estragar, precisa ser contada e muitas vezes precisa ser reposta**.

## 2. Por que um mercadinho foi escolhido?

**[FONTE]** O boletim *Mercadinhos* do Sebrae/RN descreve desafios relacionados a disponibilidade e distribuição de produtos, negociação com fornecedores e perdas decorrentes de vencimento, perecíveis, avarias e falhas operacionais. O documento é histórico e regional: não pode ser usado como medida nacional de 2026 nem como prova de frequência atual de cada problema. Fonte S1.

**[FONTE]** Material do Sebrae sobre controle de mercadorias enfatiza o conhecimento de quantidades e valores em estoque, cadastro por itens e inventários periódicos/rotativos. Fonte S2.

**[FONTE]** O Sebrae diferencia o controle de caixa de resultado econômico: fluxo de caixa representa recebimentos e pagamentos em diferentes períodos; receitas, custos, despesas e impostos compõem outro tipo de análise. Fontes S3 e S4.

**[HIPÓTESE DE PROJETO]** Esse contexto proporciona uma boa demonstração de automação que seja fácil de verificar visualmente e que tenha valor operacional reconhecível: estoque mínimo, histórico de vendas e alertas de perdas.

**[DECISÃO]** A MERCA 27 será uma loja fictícia pequena, sem filiais e sem PDV real. Esse recorte é **um artifício pedagógico**, não recomendação de implantar planilhas para qualquer estabelecimento existente.

## 3. Diagnóstico por processo operacional

### 3.1. Cadastro de produtos

**Problema:** produtos com nomes inconsistentes, códigos duplicados, preços digitados em locais diferentes, unidade não padronizada e categoria imprecisa.

**O sistema deve representar:** SKU único, nome comercial, categoria, unidade, custo de referência, preço de venda, mínimo, alvo e status. Alterações precisam de regra: trocar o cadastro não pode reescrever preços de vendas históricas.

**Métrica demonstrável:** nenhum SKU duplicado no dataset; validação de valores e de campos obrigatórios.

### 3.2. Entrada e recebimento

**Problema:** a quantidade recebida diverge da encomendada; produtos são guardados sem registrar movimento; fornecedor é lembrado somente quando falta estoque.

**O sistema deve representar:** entrada confirmada por SKU, quantidade, custo quando pertinente, referência de fornecedor fictício, data e responsável simulado. Entrada pode ser parcial; observações devem ser rastreáveis.

**Métrica demonstrável:** saldo após entrada e log de movimentos conciliáveis.

### 3.3. Venda e baixa de estoque

**Problema:** uma venda é registrada sem validar saldo; o sistema permite quantidades impossíveis; dois registros iguais geram baixa duplicada.

**O sistema deve representar:** uma venda composta de múltiplos itens; preço praticado preservado; dedução de estoque somente após aprovação integral; identificação única por tentativa; rejeição de estoque insuficiente.

**Métrica demonstrável:** simular saldo 2 e tentar vender 3 — operação falha sem alteração parcial; repetir mesma solicitação e não vender duas vezes.

### 3.4. Reposição

**Problema:** o proprietário compra por percepção, sem ver quanto resta ou quanto costuma vender.

**O sistema deve representar:** no primeiro MVP, regra transparente: `necessidade = max(0, alvo - saldo atual)`, somente se abaixo do mínimo/limiar adotado. Não é previsão estatística de demanda.

**Métrica demonstrável:** lista de itens que precisam de reposição, quantidades e motivos. Introduzir tempo de entrega do fornecedor e consumo diário apenas em etapa avançada.

### 3.5. Perdas, avarias e validade

**[FONTE]** O Sebrae/RN inclui perdas por vencimento, perecíveis e avarias entre os problemas relevantes de mercadinhos (S1). Material sobre minimercados do Sebrae também enfatiza atenção à validade; esse segundo documento é histórico e não substitui orientação sanitária/legal atual (S5).

**Primeiro MVP:** lançamentos de perda por motivo e quantidade, sem controle de lote.

**Depois do MVP:** lote, validade, entrada por lote, alerta de itens próximos do vencimento e política FEFO (*first-expire, first-out*, quando aplicável). Sem lote não devemos prometer decisão automática de qual unidade física retirar da prateleira.

**Métrica demonstrável:** uma perda reduz saldo e aparece separadamente de venda no painel.

### 3.6. Inventário físico e divergências

**Problema:** o saldo teórico pode não corresponder à prateleira, por perdas, falhas de registro ou erros de contagem.

**O sistema deve representar:** contagem cega ou registrada, diferença entre esperado e contado, motivo e lançamento compensatório. **Não sobrescrever o saldo sem registrar ajuste.**

**Métrica demonstrável:** saldo esperado 10, contagem 8, movimento de ajuste -2 com responsável e justificativa.

### 3.7. Financeiro gerencial

**[FONTE]** O Sebrae explica que entrada e saída de caixa, receitas, custos, despesas e lucro são conceitos diferentes; um negócio pode enfrentar problema de caixa apesar de registrar vendas. Fontes S3 e S4.

**Primeiro MVP:** receita de vendas, custo estimado associado ao item no momento da venda, margem bruta estimada, unidades vendidas, ticket médio. **Não calcular "lucro líquido" sem registrar despesas/tributos de modo consistente.**

**Fase seguinte:** despesas fixas/variáveis, pagamentos e recebimentos, fluxo de caixa por data efetiva, saldos e projeções rotuladas como aproximações.

### 3.8. Indicadores para decisões, não para decoração

**Decisão de produto:** cada KPI precisa responder a uma pergunta:

| Pergunta gerencial | Indicador | Ação possível |
|---|---|---|
| O que falta na prateleira? | SKUs abaixo do mínimo | Conferir e repor |
| O que vendeu hoje? | Receita, unidades e vendas | Conferir movimento |
| O que está parado? | Dias sem movimentação e saldo | Revisar compras (futuro) |
| Qual produto responde por mais receita? | Receita por SKU | Compreender mix sem confundir com lucro |
| Onde perdemos mercadoria? | Perdas por motivo/categoria | Investigar processo |
| Qual reposição sugerir? | Alvo − saldo | Revisão humana antes de comprar |

**Regra:** não inventar gráficos sem rótulos, unidades, período e caminho até o lançamento original.

## 4. Comparação de caminhos tecnológicos

| Opção | Pontos fortes | Limitações | Veredito para A-002 |
|---|---|---|---|
| Planilha sem script | Simples, fórmulas visíveis, fácil começar | Edição manual, erros e falta de processos confiáveis | Boa para aprender, fraca como entrega final |
| **Google Sheets + Apps Script** | Menus, formulários, automações e integração nativa; custo inicial baixo | Cotas, colaboração concorrente limitada, permissões e manutenção | **Escolha do MVP** |
| Python + CSV/SQLite local | Excelente para regras, testes, automações e dados maiores | Interface e implantação exigem mais trabalho | Apoio opcional; ótimo para próxima geração |
| App web com DB transacional | Controle granular de autenticação, integridade e escalabilidade | Maior complexidade e custo | Não implementar agora |
| ERP/PDV pronto | Fiscal, operações e módulos maduros (variável por fornecedor) | Menos adequado a um case autoral de automação do zero | Comparador conceitual, não concorrente a replicar |

**[FONTE]** Google Apps Script permite estender Sheets com menus, caixas de diálogo, sidebars, funções e integrações (G1). As boas práticas recomendam operações em lotes e menos chamadas externas (G2). Existem cotas e limites que podem interromper execuções; dependem da conta e podem mudar (G3).

**[DECISÃO]** Validaremos a lógica antes da sofisticação da UI. No projeto, a planilha é camada de armazenamento/apresentação; as regras vivem em funções testáveis e operações explicitamente controladas.

**[DECISÃO — v1.1.0]** Com a lógica validada nas Fases 00 e 01, a interface passa a ser feita com **Angular + Tailwind CSS**, empacotada como HTML único dentro do Apps Script. Isso não muda o veredito da tabela: continua sendo Sheets + Apps Script, sem backend nem banco remoto. Custo da escolha: etapa de build e pacote maior que HTML puro, aceitos pelo ganho de consistência visual e manutenção dos componentes.

## 5. Pesquisa técnica: riscos e escolhas

### 5.1. Triggers do Apps Script não são mágica

**[FONTE]** `onOpen` e `onEdit` têm restrições; alterações realizadas por scripts não disparam automaticamente um `onEdit` como se o usuário tivesse editado uma célula. Triggers instaláveis têm comportamento e permissões próprios. Fontes G4 e G5.

**Implicação:** não depender de um trigger de edição para manter saldos de vendas. Toda operação de venda deve chamar a mesma rotina de domínio que registra venda e movimentos de estoque. Triggers podem gerar relatórios e alertas, mas não devem ser a única fonte de integridade.

### 5.2. Concorrência

**[FONTE]** `LockService` do Apps Script existe para evitar colisões quando usuários/processos alteram recurso compartilhado, com restrições contextuais para locks por documento. Fonte G6.

**Implicação:** confirmar transação, consultar saldo atual e registrar saídas dentro de uma seção crítica, de modo a evitar corrida entre dois operadores. Isso **não transforma Sheets em banco transacional com rollback automático**; exigiremos validações e plano de recuperação.

### 5.3. Eficiência e cotas

**[FONTE]** O Google recomenda reduzir acesso a serviços externos e usar leitura/gravação em blocos. Apps Script impõe cotas e limites diários e por execução. Fontes G2 e G3.

**Implicação:** ler ranges por lote, calcular em memória, gravar blocos, não disparar e-mail a cada linha, não recomputar a base inteira desnecessariamente. Ao exceder cotas, exibir erro e registrar falha, não confirmar um processamento incompleto.

### 5.4. Versionamento e desenvolvimento local

**[FONTE]** O Google oferece `clasp`, CLI para trabalhar com Apps Script em arquivos locais (G7). **[DECISÃO]** O projeto será escrito com fonte versionável, testes de domínio locais e sincronização controlada com Apps Script quando as permissões e contas utilizadas permitirem.

### 5.5. Privacidade, segurança e dados de teste

**[FONTE]** A ANPD disponibiliza guia e checklist de segurança para agentes de tratamento de pequeno porte (A1), e a LGPD tem requisitos mesmo em operações pequenas, observada a regulação aplicável. **[DECISÃO]** o protótipo usará exclusivamente pessoas, fornecedores, preços e transações inventados. Proteção de aba não substitui autenticação/controle real de acesso; se houver uso real no futuro, será exigida nova avaliação.

## 6. Pesquisa de concorrência e diferenciação — sem fingir benchmarking

Não foi feita comparação de preços ou testes de ERPs específicos nesta pesquisa. Portanto, **não** afirmar que o PULSO é mais barato, mais rápido ou mais completo que sistemas comerciais.

**Diferencial aspiracional do case:** automação pequena e compreensível; lançamento controlado; dado conciliável; suporte para erro; documentação de uso; dashboard que explica o cálculo; base reutilizável. Isso será comprovado por **testes próprios**, não por marketing.

## 7. Ideias complementares priorizadas

| Ideia | Valor pedagógico | Complexidade | Quando |
|---|---|---|---|
| Resumo diário de estoque baixo | Alta | Baixa–média | Fase 3 |
| Ajuste de inventário auditável | Alta | Média | Fase 1 |
| Venda multi-itens com validação integral | Muito alta | Média | Fase 2 |
| Dashboard de giro e vendas | Alta | Média | Fase 3 |
| Exportação PDF de relatório | Média | Média | Fase 4 |
| Importação de CSV simulada | Alta | Média | Fase 4 |
| Lotes e validade | Alta | Alta | Pós-MVP |
| Previsão de ruptura por demanda | Média | Alta | Pós-MVP; sem IA antes de regras simples |
| Chatbot WhatsApp para pedidos de reposição | Baixa no contexto inicial | Alta/regulado | Não incluir |
| Sistemas completos de emissão fiscal | Não é objetivo do case | Muito alta | Fora do escopo |

## 8. Questões que pesquisa documental NÃO responde

- Com que frequência um mercadinho específico tem ruptura ou perda?
- Qual taxa média de margem ou ticket por categoria em São Paulo em 2026?
- Quanto um lojista pagaria por implantação/automação?
- Quanto tempo os funcionários gastariam efetivamente em lançamentos?
- Qual solução atual usam (PDV, ERP, caderno, Sheets)?
- Quantos usuários simultâneos e transações diárias exigiriam outra arquitetura?

**Resposta correta:** são incógnitas. Se no futuro o projeto virar oferta comercial, realizar entrevistas e observação autorizada de processos reais; nunca inventar números para responder.

## 9. Roteiro de descoberta futura (sem realizar trabalho comercial agora)

1. Como uma entrada de mercadoria é registrada hoje?
2. O que acontece quando um cliente pede produto que acabou?
3. Como vocês sabem o que precisa ser comprado amanhã?
4. Como registram perda por vencimento/avaria?
5. Como conferem estoque real versus sistema?
6. Qual é a maior fonte de retrabalho no registro de vendas?
7. Qual software ou planilha já usam e o que funciona bem?
8. Quem pode editar cadastros e corrigir lançamentos?
9. Quais números o proprietário realmente consulta toda manhã?
10. Que falha tornaria uma solução inaceitável?

Este roteiro é para aprendizagem de produto; **não pressupõe venda ou prestação de trabalho pelo usuário menor de idade**.

## 10. Fontes consultadas e como usá-las

Acesso/consulta: **18/11/2026**. Links podem mudar. Não usar materiais históricos como estatísticas atuais.

| Código | Instituição | Material | Papel da evidência |
|---|---|---|---|
| S1 | Sebrae/RN | Boletim Mercadinhos (PDF, material histórico) | Ruptura, fornecedores, perdas; não extrapolar dados regionais |
| S2 | Sebrae | Como realizar controle de estoque de mercadorias | Cadastro, quantidades, inventários e movimentações |
| S3 | Sebrae | Como fazer gestão financeira do pequeno negócio | Receita versus custos/despesas/resultado |
| S4 | Sebrae | O que é fluxo de caixa e como aplicá-lo | Recebimentos/pagamentos e liquidez |
| S5 | Sebrae | Fatores-chave de sucesso em minimercados (material histórico) | Validade e gestão de produtos |
| G1 | Google Developers | Extend Google Sheets | Interfaces e integrações via Apps Script |
| G2 | Google Developers | Apps Script Best Practices | Batch operations e performance |
| G3 | Google Developers | Google Services Quotas | Limites operacionais que podem mudar |
| G4 | Google Developers | Simple Triggers | Restrições de `onEdit`/`onOpen` |
| G5 | Google Developers | Installable Triggers | Autorização e gatilhos programados |
| G6 | Google Developers | Lock Service | Coordenação de gravações concorrentes |
| G7 | Google Developers | clasp CLI | Desenvolvimento local/versionamento |
| A1 | ANPD | Guia de segurança para agentes de tratamento de pequeno porte | Orientação de segurança e checklist |

**URLs exatas:**

- S1: https://sebrae.com.br/Sebrae/Portal%20Sebrae/UFs/RN/Anexos/Versa%CC%83o%201%20-%20Boletim%20-%20Mercadinhos.pdf
- S2: https://meuatendimento.sebrae.com.br/sites/PortalSebrae/artigos/como-elaborar-o-controle-de-estoque-de-mercadorias,8e80438af1c92410VgnVCM100000b272010aRCRD
- S3: https://meuatendimento.sebrae.com.br/sites/PortalSebrae/artigos/como-fazer-a-gestao-financeira-do-pequeno-negocio,d999a442d2e5a410VgnVCM1000003b74010aRCRD
- S4: https://meuatendimento.sebrae.com.br/sites/PortalSebrae/artigos/fluxo-de-caixa-o-que-e-e-como-implantar,b29e438af1c92410VgnVCM100000b272010aRCRD
- S5: https://bibliotecas.sebrae.com.br/chronus/ARQUIVOS_CHRONUS/bds/bds.nsf/c4acbb8ba6ccf8a89849ba343fd5e065/%24File/SP_minimercado_17.pdf
- G1: https://developers.google.com/apps-script/guides/sheets
- G2: https://developers.google.com/apps-script/guides/support/best-practices
- G3: https://developers.google.com/apps-script/guides/services/quotas
- G4: https://developers.google.com/apps-script/guides/triggers
- G5: https://developers.google.com/apps-script/guides/triggers/installable
- G6: https://developers.google.com/apps-script/reference/lock
- G7: https://developers.google.com/apps-script/guides/clasp
- A1: https://www.gov.br/anpd/pt-br/centrais-de-conteudo/materiais-educativos-e-publicacoes/guia-orientativo-sobre-seguranca-da-informacao-para-agentes-de-tratamento-de-pequeno-porte

## 11. Síntese e conclusão

A pesquisa **apoia a escolha** de uma solução didática que atenda a estoque, vendas, perdas, fornecedores e disciplina financeira. Ela **não demonstra** que a MERCA 27 existe, que todos os mercadinhos enfrentam os mesmos problemas, ou que a solução seria comercialmente superior a ERPs disponíveis.

**Caminho recomendado:** implementar fluxo mínimo rastreável de cadastro → entrada → venda → saldo → alerta → relatório, com dados sintéticos e testes explícitos. Só depois adicionar automações adicionais e um visual mais sofisticado.
