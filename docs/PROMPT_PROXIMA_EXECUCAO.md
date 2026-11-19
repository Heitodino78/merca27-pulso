# Prompt para a próxima execução — A-002 / PULSO

Copie o bloco abaixo e execute na raiz do projeto.

```text
# A-002 — MERCA 27 / PULSO — MELHORIAS APROVADAS, INTEGRAÇÃO GOOGLE (SE AUTORIZADA) E FASE 1

Você continuará o PULSO, sistema de gestão de um mercado inteiramente fictício. Trabalhe diretamente nos arquivos do projeto.

## LEITURA OBRIGATÓRIA

1. docs/MELHORIAS_PLANEJADAS.md (escopo e critérios de aceite desta execução)
2. docs/RELATORIO_FASE_00.md, docs/PROGRESSO.md, docs/DECISOES.md e docs/TESTES.md
3. docs/00_COMECE_AQUI.md a docs/04_ROTEIRO_EXECUCAO_E_PROMPT.md
4. Todo o código em src/, local/ e tests/

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

As melhorias M-01 a M-07, adaptador de Google Sheets, menu, interface visual, perda, ajuste por contagem, alerta de reposição, fornecedores, vendas e dashboard. Nada disso deve ser tratado como pronto.

## ETAPA 1 — AMBIENTE

1. Verifique Node.js (22 ou superior), Git e clasp. O Node não estava instalado no sistema na Fase 00.
2. Execute npm test e npm run check antes de qualquer alteração. Se algo falhar, corrija primeiro.
3. Verifique se há conta Google autorizada. Não peça senhas e não contorne login ou permissões.

## ETAPA 2 — MELHORIAS DE FUNDAÇÃO

Implemente nesta ordem, cumprindo os critérios de aceite de docs/MELHORIAS_PLANEJADAS.md e executando os testes ao final de cada item:

1. M-07: checagem de tipos.
2. M-01: custo unitário na entrada.
3. M-02: alteração e desativação de produto.
4. M-04: reconciliação automática.
5. M-05: desempenho e leituras sem trava.

## ETAPA 3 — INTEGRAÇÃO GOOGLE (SOMENTE COM CONTA AUTORIZADA)

1. Crie adaptadores finos para as portas: SpreadsheetApp, LockService e Utilities.getUuid.
2. Trate a conversão entre célula vazia e null, grave instantes como texto e use leitura e escrita em lote.
3. Crie um menu mínimo que permita executar o fluxo principal.
4. Repita o cenário obrigatório na planilha real e registre a evidência em docs/TESTES.md.

Sem conta autorizada, não simule a integração: registre a pendência e siga para a Etapa 4.

## ETAPA 4 — FASE 1: ESTOQUE E INTEGRIDADE

1. Expanda o catálogo para 40 SKUs e 6 fornecedores fictícios, mantendo o gerador determinístico.
2. Implemente SALDO_INICIAL auditável, registrarPerda e ajustarPorContagem usando o executor de operações existente.
3. Rejeite perda acima do saldo e ajuste de diferença zero. Motivo é obrigatório em perda e ajuste.
4. Implemente alerta e sugestão de reposição: sugestao = max(0, alvo - saldo) quando o alerta estiver ativo. Registre em docs/DECISOES.md a política escolhida; a recomendação é alerta = saldo <= mínimo.
5. Teste os limites em saldo 0, igual ao mínimo e acima do mínimo.

## ETAPA 5 — INTERFACE

Implemente M-06 sobre os casos de uso já estáveis. A pré-visualização local não conta como integração com o Google. Se a Etapa 3 foi concluída, publique a mesma interface no Apps Script e teste no ambiente real.

## FORA DESTA EXECUÇÃO

M-03 deve ser feita no início da execução da Fase 2, antes de vendas. Não implemente vendas, dashboard ou automações periódicas agora.

## REGRAS

- Conclua as etapas em ordem. Se não for possível terminar tudo com qualidade, pare ao fim de um item completo e registre exatamente o que ficou pendente.
- Não altere os documentos-base. Registre divergências em docs/DECISOES.md.
- Não enfraqueça nem desative testes para fazê-los passar. Toda mudança de comportamento aprovada deve ser substituída por testes equivalentes ou mais rigorosos.
- Use apenas dados sintéticos. Não exponha credenciais, não publique nada e não envie a repositórios remotos sem autorização.
- Não declare como executado o que não foi executado.

## CRITÉRIOS DE ACEITE

- Os critérios de cada melhoria implementada foram cumpridos e têm evidência em docs/TESTES.md.
- Todos os saldos batem com o log de movimentos e nenhuma ação inválida é confirmada.
- Testes cobrem perda, ajuste, reposição, idempotência e recuperação de falhas.
- Documentação atualizada com o estado real.

## ENTREGA

Marque em docs/MELHORIAS_PLANEJADAS.md apenas o que foi concluído. Atualize docs/PROGRESSO.md, docs/DECISOES.md e docs/TESTES.md. Crie docs/RELATORIO_FASE_01.md e atualize este prompt com base no estado real.
```
