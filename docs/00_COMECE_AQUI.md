---
title: "A-002 / MERCA 27 — Comece aqui"
project: "Agência / Plano A / Projeto A-002"
status: "Planejamento documentado; implementação ainda não iniciada"
version: "1.0.0"
date: "2026-11-18"
tags: [a002, automacoes, varejo, mercearia, portfolio, documento-base]
---

# A-002 — MERCA 27 | Guia dos documentos

> **Propósito:** criar o segundo case **educacional** do Plano A: uma solução de gestão e automação para um pequeno comércio **inteiramente fictício**. Não é sistema fiscal, contábil ou produto pronto para clientes reais.

## Decisão de contexto

**Empresa fictícia escolhida:** **MERCA 27 — Mercado de Bairro** (nome de trabalho, sem checagem de disponibilidade de marca). É uma única loja fictícia de conveniência e itens essenciais, com vendas presenciais, pequenos fornecedores e mercadorias com ou sem validade. Nada neste material representa uma loja real, endereço, CNPJ ou resultado comercial efetivo.

**Produto de software (nome interno):** **PULSO — Gestão Operacional MERCA 27**. A MERCA 27 é o *cliente fictício*; o PULSO é a *solução construída para o portfólio da agência*. Essa separação é deliberada: outros segmentos poderão utilizar a arquitetura em projetos posteriores.

**Decisão inicial da stack:** Google Sheets + Google Apps Script + formulários/interface leve. Código versionado localmente, preferencialmente via `clasp` quando conveniente. Python é opcional para geração de dados sintéticos e testes; não é requisito operacional do MVP. Sem backend dedicado, sem PDV real, sem API de WhatsApp, sem emissão fiscal.

## Arquivos e ordem de leitura

1. **`01_DOCUMENTO_MESTRE_A002.md`** — visão, cenário empresarial, requisitos, identidade, objetivos, limites, experiência e critérios de aceite. **Fonte de verdade de produto.**
2. **`02_PESQUISA_MERCADO_E_OPERACAO.md`** — pesquisa de fontes oficiais, hipóteses, problemas a resolver, alternativas e lacunas. Distingue evidência da modelagem fictícia.
3. **`03_ARQUITETURA_DADOS_E_TESTES.md`** — entidades, regras de negócio, arquitetura de Sheets/Apps Script, operações, segurança, testes e catálogo de falhas.
4. **`04_ROTEIRO_EXECUCAO_E_PROMPT.md`** — fases, backlog, definição de pronto e prompt para iniciar com Codex ou Claude Code.

## Regras para todas as IAs

- **Ler os quatro arquivos antes de implementar.** Não criar outra empresa fictícia, não mudar a stack ou o escopo sem documentar o motivo.
- **O que está marcado como `DECIDIDO` é proposta de referência aprovada neste planejamento;** se o proprietário do projeto mudar uma decisão, registrar um ADR. O que está `PLANEJADO` não está pronto.
- **Nenhum código do A-002 foi implementado nesta entrega.** Os arquivos são arquitetura e planejamento, não relatórios de testes executados.
- Tratar os dados sintéticos como **fictícios**, inclusive valores, fornecedores, margens e volume de transações.
- Não misturar dinheiro que entra, faturamento, margem bruta, lucro e saldo de caixa.
- Não produzir dashboards que insinuem métricas reais ou números garantidos.
- Desenvolver por fatias funcionais: cadastro → movimentação → venda → alertas → dashboard → acabamento.
- **Não permitir estoque negativo ou vendas duplicadas**, salvo cenário explícito de importação com erro que deva ser rejeitado.
- Não inserir contas reais, telefones, CPF, CNPJ ou dados pessoais de clientes nos exemplos.
- Diferenciar claramente demonstração funcional de produto pronto para uso empresarial real.

## O que é um primeiro sucesso?

Na versão inicial, uma pessoa deve conseguir: cadastrar um produto, registrar uma entrada, registrar uma venda, ver o saldo atualizado, identificar uma necessidade de reposição e consultar um painel coerente. O sistema deve rejeitar venda sem estoque, ação duplicada e valores inválidos. Tudo em ambiente de testes.

## Estado atual

| Item | Estado |
|---|---|
| Setor e cliente fictício | **Definido** |
| Pesquisa setorial e técnica | **Compilada, com links** |
| Requisitos e arquitetura-alvo | **Definidos como proposta inicial** |
| Dados de demonstração | **Especificados, ainda não gerados** |
| Google Sheets criado | **Não** |
| Apps Script implementado | **Não** |
| Testes realizados | **Não** |
| Publicação | **Fora do escopo inicial** |

## Próximo passo concreto

Abrir uma pasta local `A002-MERCA27`, salvar estes quatro arquivos em `docs/`, iniciar o desenvolvimento pela **Fase 0 — ambiente e modelo mínimo de dados**, seguindo `04_ROTEIRO_EXECUCAO_E_PROMPT.md`. Não criar todas as abas e automações antes de validar o primeiro fluxo de estoque.
