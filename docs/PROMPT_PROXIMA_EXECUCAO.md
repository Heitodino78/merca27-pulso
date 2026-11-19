# Prompt para a próxima execução — A-002 / PULSO

Copie o bloco abaixo e execute na raiz do projeto.

```text
# A-002 — MERCA 27 / PULSO — INTEGRAÇÃO GOOGLE (SE AUTORIZADA) E FASE 1

Você continuará o PULSO, sistema de gestão de um mercado inteiramente fictício. Trabalhe diretamente nos arquivos do projeto.

## LEITURA OBRIGATÓRIA

1. docs/RELATORIO_FASE_00.md, docs/PROGRESSO.md, docs/DECISOES.md e docs/TESTES.md
2. docs/00_COMECE_AQUI.md a docs/04_ROTEIRO_EXECUCAO_E_PROMPT.md
3. Todo o código em src/, local/ e tests/

Confirme o estado real pelo código. Em caso de divergência, o código e os testes executados prevalecem sobre este prompt.

## O QUE JÁ EXISTE

- Núcleo em src/, escrito como scripts globais (var PULSO), sem APIs do Node.
- Casos de uso: cadastrarProduto, registrarEntrada, consultarEstoque, listarProdutos e reconciliarPendencias.
- Protocolo de escrita PENDENTE -> dado -> CONFIRMADA em src/application/operacoes.js.
- Portas: armazenamento { ler, anexar }, lock { executar }, relogio e gerarId.
- Adaptadores locais em local/ (JSONL, trava por arquivo e CLI).
- Catálogo sintético de 6 SKUs, com semente 27.
- 112 testes locais aprovados na Fase 00.

## O QUE NÃO EXISTE

Adaptador de Google Sheets, menu, sidebar, identidade visual aplicada, perda, ajuste por contagem, alerta de reposição, fornecedores, edição ou desativação de produto, vendas e dashboard. Nada disso deve ser tratado como pronto.

## ETAPA 1 — AMBIENTE

1. Verifique Node.js (22 ou superior), Git e clasp. O Node não estava instalado no sistema na Fase 00.
2. Execute npm test e npm run check antes de qualquer alteração. Se algo falhar, corrija primeiro.
3. Verifique se há conta Google autorizada. Não peça senhas e não contorne login ou permissões.

## ETAPA 2 — INTEGRAÇÃO GOOGLE (SOMENTE COM CONTA AUTORIZADA)

1. Crie adaptadores finos para as portas: SpreadsheetApp, LockService e Utilities.getUuid.
2. Trate a conversão entre célula vazia e null, grave instantes como texto e use leitura e escrita em lote.
3. Crie menu e sidebar para consultar produtos, cadastrar, registrar entrada e consultar saldo, com a paleta do Documento Mestre e estados de carregando, sucesso e erro.
4. Repita o cenário obrigatório na planilha real e registre a evidência em docs/TESTES.md.

Sem conta autorizada, não simule a integração: registre a pendência e siga para a Etapa 3.

## ETAPA 3 — FASE 1: ESTOQUE E INTEGRIDADE

1. Expanda o catálogo para 40 SKUs e 6 fornecedores fictícios, mantendo o gerador determinístico.
2. Implemente SALDO_INICIAL auditável, registrarPerda e ajustarPorContagem usando o executor de operações existente.
3. Rejeite perda acima do saldo e ajuste de diferença zero. Motivo é obrigatório em perda e ajuste.
4. Implemente alerta e sugestão de reposição: sugestao = max(0, alvo - saldo) quando o alerta estiver ativo. Registre em docs/DECISOES.md a política escolhida; a recomendação é alerta = saldo <= mínimo.
5. Teste os limites em saldo 0, igual ao mínimo e acima do mínimo.
6. Reavalie o custo de carregarEstado com o volume maior e documente a medição.

## REGRAS

- Não implemente vendas, dashboard ou automações periódicas nesta execução.
- Não altere os documentos-base. Registre divergências em docs/DECISOES.md.
- Não enfraqueça nem desative testes para fazê-los passar.
- Use apenas dados sintéticos. Não exponha credenciais, não publique nada e não envie a repositórios remotos sem autorização.
- Não declare como executado o que não foi executado.

## CRITÉRIOS DE ACEITE

- Todos os saldos batem com o log de movimentos e nenhuma ação inválida é confirmada.
- Testes cobrem perda, ajuste, reposição, idempotência e recuperação de falhas.
- Documentação atualizada com o estado real.

## ENTREGA

Atualize docs/PROGRESSO.md, docs/DECISOES.md e docs/TESTES.md. Crie docs/RELATORIO_FASE_01.md e atualize este prompt com base no estado real.
```
