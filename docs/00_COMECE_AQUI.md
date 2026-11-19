---
title: "A-002 / MERCA 27 — Comece aqui"
project: "Agência / Plano A / Projeto A-002"
status: "Fases 00 e 01 concluídas localmente; interface M-06 (Angular + Tailwind) planejada"
version: "1.1.0"
date: "2026-11-19"
tags: [a002, automacoes, varejo, mercearia, portfolio, documento-base]
---

# A-002 — MERCA 27 | Guia dos documentos

> **Propósito:** criar o segundo case **educacional** do Plano A: uma solução de gestão e automação para um pequeno comércio **inteiramente fictício**. Não é sistema fiscal, contábil ou produto pronto para clientes reais.

## Decisão de contexto

**Empresa fictícia escolhida:** **MERCA 27 — Mercado de Bairro** (nome de trabalho, sem checagem de disponibilidade de marca). É uma única loja fictícia de conveniência e itens essenciais, com vendas presenciais, pequenos fornecedores e mercadorias com ou sem validade. Nada neste material representa uma loja real, endereço, CNPJ ou resultado comercial efetivo.

**Produto de software (nome interno):** **PULSO — Gestão Operacional MERCA 27**. A MERCA 27 é o *cliente fictício*; o PULSO é a *solução construída para o portfólio da agência*. Essa separação é deliberada: outros segmentos poderão utilizar a arquitetura em projetos posteriores.

**Decisão inicial da stack:** Google Sheets + Google Apps Script + formulários/interface leve. Código versionado localmente, preferencialmente via `clasp` quando conveniente. Python é opcional para geração de dados sintéticos e testes; não é requisito operacional do MVP. Sem backend dedicado, sem PDV real, sem API de WhatsApp, sem emissão fiscal.

**Decisão de interface (v1.1.0, 19/11/2026):** as telas do PULSO serão feitas com **Angular + Tailwind CSS**, num projeto isolado em `interface/`, empacotado como um único HTML autocontido e servido pelo HTML Service do Apps Script. O núcleo de regras (`src/`) continua em JavaScript puro, sem build e sem dependências. Ver A002-ADR-011 no Documento Mestre e D-040 em `DECISOES.md`.

## Arquivos e ordem de leitura

1. **`01_DOCUMENTO_MESTRE_A002.md`** — visão, cenário empresarial, requisitos, identidade, objetivos, limites, experiência e critérios de aceite. **Fonte de verdade de produto.**
2. **`02_PESQUISA_MERCADO_E_OPERACAO.md`** — pesquisa de fontes oficiais, hipóteses, problemas a resolver, alternativas e lacunas. Distingue evidência da modelagem fictícia.
3. **`03_ARQUITETURA_DADOS_E_TESTES.md`** — entidades, regras de negócio, arquitetura de Sheets/Apps Script, operações, segurança, testes e catálogo de falhas.
4. **`04_ROTEIRO_EXECUCAO_E_PROMPT.md`** — fases, backlog, definição de pronto e prompt para iniciar com Codex ou Claude Code.

## Regras para todas as IAs

- **Ler os documentos-base antes de implementar.** Não criar outra empresa fictícia, não mudar a stack ou o escopo sem documentar o motivo.
- **O que está marcado como `DECIDIDO` é proposta de referência aprovada neste planejamento;** se o proprietário do projeto mudar uma decisão, registrar um ADR. O que está `PLANEJADO` não está pronto.
- **Estes documentos são arquitetura e planejamento, não relatórios de testes executados.** O que já foi implementado e testado está em `PROGRESSO.md`, `TESTES.md` e nos relatórios de fase.
- A interface usa Angular + Tailwind, mas não contém regras de negócio: valida apenas para orientar o usuário, e o domínio em `src/` continua decidindo tudo.
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
| Requisitos e arquitetura-alvo | **Definidos; atualizados em v1.1.0** |
| Dados de demonstração | **Seed determinística: 40 SKUs e 6 fornecedores** |
| Núcleo de regras (local) | **Fases 00 e 01 concluídas, branch `fase-01`** |
| Testes realizados | **Locais: 343 testes, checagem de tipos e 108 mutações** |
| Interface (Angular + Tailwind) | **Planejada (M-06); ainda não implementada** |
| Google Sheets criado | **Não** |
| Apps Script implementado | **Não; depende de acesso autorizado** |
| Publicação | **Fora do escopo inicial** |

## Próximo passo concreto

Executar `PROMPT_PROXIMA_EXECUCAO.md`: implementar M-06, a interface Angular + Tailwind com pré-visualização local, e integrar ao Google somente se houver acesso efetivo. Depois, M-03 e a Fase 2 (vendas). Não criar dashboard antes de vendas confiáveis.
