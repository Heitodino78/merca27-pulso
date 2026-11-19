---
title: "A-002 — Roteiro de Execução e Prompt Inicial"
project: "MERCA 27 / PULSO"
status: "Fases 00 e 01 concluídas localmente; próxima execução: M-06 com Angular + Tailwind"
version: "1.1.0"
date: "2026-11-19"
tags: [roadmap, prompt, execucao, codex, claude-code, checklist]
---

# A-002 — Do documento ao código

> **Objetivo:** repetir o método da BRASA 47: documentação → primeira execução controlada → relatório de resultados → prompt de continuidade. O núcleo é automação de pequenos negócios com Google Sheets + Apps Script. **Atualização v1.1.0:** por decisão do proprietário, a interface usa Angular + Tailwind CSS (A002-ADR-011), isolada do núcleo e empacotada para o HTML Service.

## 1. Regras de trabalho

- Uma IA pode liderar toda a fase. Não é obrigatório dividir por ferramenta.
- Começar por **um fluxo vertical verificável**, não por uma lista enorme de funcionalidades.
- Sempre inspecionar arquivos existentes e ambiente antes de gerar novos.
- Não tratar projeto previsto como projeto já executado.
- Fazer mudanças incrementais e testes antes de refinar visual.
- Preservar documentos-base e registrar diferenças em ADRs.
- Entregar relatório real no fim de cada fase e novo prompt baseado no que existe.
- Usar dados 100% fictícios, sem publicar uma planilha com informação real.
- Evitar instalação, permissões ou serviços pagos desnecessários.

## 2. Plano de fases

### Fase 0 — Ambiente e primeira vertical

**Objetivo:** definir as bases, conectar ambiente local ao Apps Script se autorizado e comprovar `cadastro → entrada → saldo`.

Tarefas:

- [ ] Ler os quatro documentos e inspecionar ambiente local.
- [ ] Definir diretório do A-002 em Linux, separado do BRASA 47.
- [ ] Verificar Node/npm/Git e acesso permitido a Apps Script/Google Sheets; não presumir sessão autenticada.
- [ ] Definir estratégia local (`clasp` ou documentação/manual) sem usar credenciais de terceiros.
- [ ] Criar `README.md`, `docs/PROGRESSO.md`, `docs/DECISOES.md`, `docs/TESTES.md`.
- [ ] Modelar Produto e Movimento com funções puras.
- [ ] Gerar pequenos dados sintéticos reproduzíveis (p. ex. 6 SKUs no teste; 40 na seed da fase 1).
- [ ] Implementar entrada auditável e consulta de saldo; validar quantidade e SKU.
- [ ] Montar a interface mínima de lançamento, se houver integração com Sheets disponível.
- [ ] Testar saldo anterior/depois, entrada inválida, SKU ausente e ID duplicado.
- [ ] Registrar o que foi de fato rodado localmente versus Google.

**Entregável:** protótipo demonstrável de cadastro, entrada e saldo, sem dashboards nem venda; documentação de configuração e testes.

**Critério:** uma entrada válida aumenta saldo exatamente uma vez; inválida não muda nada.

### Fase 1 — Estoque e integridade

**Objetivo:** completar perda, ajuste por inventário, regras de alerta e logs.

- [ ] Catálogo 40 SKUs + 6 fornecedores fictícios revisados.
- [ ] Entrada e posição inicial auditáveis.
- [ ] Perda por motivo e ajuste por contagem.
- [ ] Saldos reconciliáveis com todos os movimentos.
- [ ] Estoque mínimo e alvo configuráveis.
- [ ] Tabela de reposição e testes de limite.
- [ ] Interface que não obriga editar histórico manualmente.
- [ ] Testes de erros, idempotência e recuperação.

**Critério:** todos os saldos batem com log de movimentos e nenhuma ação inválida é confirmada.

### Fase 2 — Vendas

**Objetivo:** introduzir operação multi-itens correta, preservar histórico e impedir vendas indevidas.

- [ ] Venda com ID/requisição únicos.
- [ ] Agrupar itens repetidos ou rejeitar explicitamente.
- [ ] Checar saldo dentro de lock.
- [ ] Registrar valores históricos de preço/custo estimado.
- [ ] Implementar estratégia documentada para falhas parciais nas múltiplas abas.
- [ ] Evitar dupla confirmação e duplicidade.
- [ ] Implementar estorno/reversão em escopo controlado.
- [ ] Testes de concorrência simulada, saldo insuficiente e transação parcial.

**Critério:** dois cliques na mesma venda não geram duas baixas; se um item não tiver saldo, a venda inteira não é aceita.

### Fase 3 — Automação e dashboard

**Objetivo:** dados compreensíveis para o gestor e alertas úteis.

- [ ] Visão Geral com filtros por período.
- [ ] Receita bruta, vendas, ticket médio, CMV/margem estimados.
- [ ] Indicadores de estoque baixo e perdas.
- [ ] Lista de compras **sugerida**, nunca pedido automático.
- [ ] Trigger opcional de relatório diário com logs e limites.
- [ ] Visão de falhas de automação e última execução.
- [ ] Testes que reconciliam os KPIs com vendas e movimentos.

**Critério:** números podem ser verificados a partir do histórico; trigger que falha não é tratado como sucesso.

### Fase 4 — Polimento e portfólio

**Objetivo:** produto de demonstração bem apresentado, documentado e utilizável.

- [ ] Refinar o design system (tokens do tema Tailwind e componentes Angular) e a operação mobile quando pertinente.
- [ ] Mensagens de erro, ajuda breve, tutorial e estados vazios.
- [ ] Testes exploratórios com pessoas de confiança, registrando observações.
- [ ] Revisar acesso, backup, segurança e custos/cotas.
- [ ] Produzir screenshots, diagrama e case de portfólio **fictício**.
- [ ] Exportar/arquivar o projeto localmente, sem publicação obrigatória.

**Critério:** o case mostra problema, solução, funcionalidade, stack, limitações e testes realmente executados.

## 3. Backlog consolidado por valor

| ID | Item | Valor | Fase |
|---|---|---|---|
| A002-01 | Modelo de produto tipado/validado | Fundação | 0 |
| A002-02 | Modelo de movimento auditável | Integridade | 0 |
| A002-03 | Registro de entrada | Primeiro fluxo | 0 |
| A002-04 | Consulta de saldo | Primeiro fluxo | 0 |
| A002-05 | Seed e reset de teste | Reprodutibilidade | 0–1 |
| A002-06 | Perda e ajuste por contagem | Integridade | 1 |
| A002-07 | Cadastro de fornecedor fictício | Operação | 1 |
| A002-08 | Reposição pelo mínimo/alvo | Ação gerencial | 1 |
| A002-09 | Venda multi-itens | Ciclo comercial | 2 |
| A002-10 | Lock, idempotência e reconciliação | Correção | 2 |
| A002-11 | Histórico e estorno controlado | Auditoria | 2 |
| A002-12 | Indicadores gerenciais | Visibilidade | 3 |
| A002-13 | Trigger/relatório controlado | Automação | 3 |
| A002-14 | Refinamento visual e UX | Apresentação | 4 |
| A002-15 | Testes exploratórios e case | Portfólio | 4 |

## 4. Condições para não ampliar escopo

- Angular + Tailwind só na camada de interface (`interface/`), nunca no núcleo `src/`, e sem regras de negócio nos componentes.
- Sem bibliotecas de componentes prontas, CDN no HTML final ou backend próprio para servir a interface.
- Não criar chatbot, IA de demanda, integração com WhatsApp ou ERP fiscal na primeira execução.
- Não criar login próprio se ainda não há sistema web externo.
- Não adicionar validade por lote ao mesmo tempo que venda multi-itens.
- Não enviar e-mails automáticos sem destinatários de teste autorizados e consentimento relevante.
- Não incluir valores reais de lojas e pessoas em um dataset supostamente sintético.
- Não apresentar análise financeira do painel como apuração contábil.

## 5. Prompt inicial para Codex ou Claude Code

> **Histórico:** este é o prompt da Fase 0, já executado. A execução atual está em `PROMPT_PROXIMA_EXECUCAO.md`.

Copiar **apenas o bloco abaixo** e executar na pasta do novo projeto (com os quatro MD em `docs/`).

```text
# A-002 — MERCA 27 / PULSO — INÍCIO DA IMPLEMENTAÇÃO

Você será responsável pela engenharia, automações, modelagem de dados, UX operacional, testes e documentação do Projeto A-002. Sua tarefa é trabalhar diretamente no projeto existente no diretório atual, não entregar apenas ideias ou trechos de código.

CONTEXTO E LEITURA OBRIGATÓRIA

Leia integralmente, nesta ordem:
- docs/00_COMECE_AQUI.md
- docs/01_DOCUMENTO_MESTRE_A002.md
- docs/02_PESQUISA_MERCADO_E_OPERACAO.md
- docs/03_ARQUITETURA_DADOS_E_TESTES.md
- docs/04_ROTEIRO_EXECUCAO_E_PROMPT.md

A MERCA 27 é um mercadinho inteiramente fictício. O PULSO é a solução de gestão e automação criada para demonstrar competências da agência. Nada foi implementado ainda, a menos que você encontre arquivos executáveis e evidências concretas no diretório. Não misture este projeto ao BRASA 47.

MISSÃO DESTA SESSÃO: EXECUTAR A FASE 0

1. Inspecione o diretório, as ferramentas disponíveis e o estado do Git. Confirme o que existe realmente.
2. Verifique disponibilidade de Node/npm e meios de integrar com Google Sheets/Apps Script. Não assuma autenticação em uma conta Google. Não contorne controles de login, permissões ou restrições de idade.
3. Proponha brevemente a arquitetura mínima e arquivos a criar. Escolha a interface mais simples para o primeiro fluxo, compatível com as ferramentas acessíveis.
4. Modele Produto e Movimento, com validação de SKU e quantidade e regras de estoque em funções puras testáveis.
5. Crie fixtures inteiramente sintéticas e determinísticas para começar (pode iniciar com 6 SKUs e expandir depois).
6. Implemente um primeiro fluxo ponta a ponta de CADASTRO → ENTRADA → SALDO, preferindo Google Sheets + Apps Script quando houver conta autorizada. Se o acesso à conta Google não estiver disponível, crie e teste o núcleo de domínio localmente e documente o procedimento de integração, sem afirmar que já publicou ou testou na nuvem.
7. Rejeite operações inválidas, duplicadas e quantidades não inteiras. Use centavos inteiros e não edite saldo manualmente.
8. Faça testes das regras, execute comandos disponíveis e corrija falhas introduzidas.
9. Escreva README.md e docs/PROGRESSO.md, docs/DECISOES.md, docs/TESTES.md com o que de fato aconteceu. Não altere o Documento Mestre sem autorização.
10. Ao terminar, gere docs/RELATORIO_FASE_00.md e docs/PROMPT_PROXIMA_EXECUCAO.md, baseados no estado real. Preserve tudo o que já funcionar.

DIRETRIZES OBRIGATÓRIAS

- Não faça um ERP completo nesta execução.
- Não implemente vendas, painel ou automações de e-mail antes de estabilizar o primeiro fluxo.
- Não invente acesso a serviços externos, testes executados ou métricas reais.
- Não produza falsos dados pessoais, contatos reais, CNPJ ou endereço.
- Não adicione dependências pagas sem necessidade.
- Não exponha credenciais.
- Utilize abordagem idempotente, logs e validação de domínio desde a fundação.
- Respeite o papel educacional/portfólio do projeto.

CRITÉRIOS DE ACEITE

Ao final, deve existir código organizado, documentação de instalação e ao menos um teste reproduzível provando que entrada válida altera saldo exatamente uma vez e entrada inválida não altera nada. Se Google Sheets não for acessível, explique o que ficou local e o que permanece por integrar, sem marcar a integração como concluída.

COMECE AGORA: inspecione a pasta, leia a documentação, apresente um plano curto e inicie a implementação real da Fase 0.
```

## 6. Modelo do relatório de execução

Após executar uma fase, criar `docs/RELATORIO_FASE_XX.md` com:

1. Data, versão, estado real, commits locais (se houver e autorizados).
2. O que foi implementado e o que não foi.
3. Principais decisões técnicas e justificativas.
4. Estrutura e arquivos alterados.
5. Ambiente/contas utilizados, sem segredos.
6. Comandos e testes efetivamente executados, com resultados.
7. Capturas de tela ou links de referência interna, somente se existirem.
8. Bugs conhecidos, limites e riscos.
9. Próxima prioridade, com critério de aceite.
10. Prompt de continuidade que **não presume recursos ainda não implementados**.

## 7. Primeiro marco de qualidade

Antes de declarar a Fase 0 concluída, provar matematicamente e por testes:

- Saldo inicial: 0.
- Entrada válida de 10 unidades do SKU MER-001: saldo 10.
- Repetição com o mesmo `requisicaoId`: saldo continua 10.
- Tentativa com quantidade -5: erro e saldo continua 10.
- Tentativa com SKU inexistente: erro e nenhum movimento extra.

A saída pode ser uma demonstração local com fixtures e teste automatizado se ainda não houver acesso autorizado ao Google Sheets. Isso é um primeiro resultado genuíno e evita construir um dashboard sobre dados inconsistentes.

## 8. O que fazer depois

Conferir `RELATORIO_FASE_00.md` e só então autorizar Fase 1. Se o sistema ainda não permite cadastro → entrada → saldo de forma correta e reproduzível, não avançar para vendas e dashboards.
