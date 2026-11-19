# Relatório de execução — Fase 01

**Data:** 18/11/2026 · **Versão do pacote:** 0.1.0 · **Branch:** `fase-01` · **Ambiente:** exclusivamente local.

## Resultado

Os blocos 0 a 9 do prompt de Fase 01 foram executados em ordem. A revisão pendente da Fase 00 foi testada e registrada sem alterar seu conteúdo no commit `6b3747b`, ainda na branch `fase-00`; a branch `fase-01` foi criada a partir dele. Não houve merge em `main`, remoto configurado, envio ou publicação. Os cinco documentos-base foram preservados.

O PULSO agora permite cadastrar fornecedores e produtos, alterar o cadastro com histórico, registrar saldo inicial, entrada, perda e contagem, consultar o saldo e obter sugestões de reposição. As operações continuam idempotentes, somente-acréscimo e confirmadas apenas após releitura. A Fase 01 está concluída localmente; interface visual e integração Google continuam pendentes.

## Funcionalidades e arquitetura

- **M-07:** JSDoc e contratos em `tipos/`, TypeScript sem build e duas configurações separando núcleo e ambiente Node. Nenhuma API Node em `src/`. `strict` permanece desativado com justificativa em D-027.
- **M-01 e fornecedores:** seis fornecedores fictícios; entrada exige fornecedor existente/ativo e custo unitário em centavos, incluindo zero para bonificação. Custo da entrada não altera o cadastro automaticamente.
- **M-02:** criação imutável e eventos em `PRODUTOS_ALTERACOES`; somente campos efetivamente alterados ficam no JSON canônico. Consulta e regras usam o estado vigente, incluindo `atualizado_em`; versões anteriores permanecem consultáveis.
- **M-04:** pendências são concluídas antes de validar novos lançamentos, dentro da trava, com recarga do estado e indicação no log. Falha impede iniciar a nova operação. Reconciliação manual e repetição idempotente permanecem disponíveis.
- **Estoque:** saldo inicial apenas antes de movimentos confirmados; perdas com AVARIA, VENCIMENTO ou QUEBRA; ajuste por contagem com saldos anterior e novo. Perdas e ajustes aceitam produto inativo. Custo de referência é capturado na operação e conferido na reprodução histórica.
- **Reposição:** produto ativo com saldo `<= mínimo`; sugestão `max(0, alvo - saldo)`. Somente consulta, sem compra automática.
- **Catálogo:** 40 SKUs em seis categorias, com seis fornecedores, semente 27. Os valores dos primeiros seis SKUs foram fixados por teste e preservados.
- **M-05:** consultas sem trava com uma repetição sob trava em caso de inconsistência; saldos projetados por SKU em memória e reutilização limitada da tabela já lida na reconciliação. Releituras reais de confirmação permanecem obrigatórias.

O executor continua usando um único `{ tabela, linha }` por operação: intenção `PENDENTE` → dado → `CONFIRMADA`. Os eventos são reproduzidos na ordem do log para reconstruir produtos, versões e movimentos. O saldo não é persistido. O adaptador JSONL mantém apenas `ler` e `anexar`, completa escritas parciais em bytes e sincroniza o descritor. A CLI só converte argumentos e apresenta resultados.

## Arquivos

| Grupo | Arquivos principais |
|---|---|
| Novos domínios | `src/domain/fornecedor.js`, `src/domain/alteracao.js` |
| Núcleo ampliado | `src/domain/movimento.js`, `src/domain/estoque.js`, `src/infra/esquema.js`, `src/infra/repositorio.js`, `src/application/*`, `src/pulso.js` |
| Contratos e ferramentas | `tipos/contratos.d.ts`, `tsconfig.src.json`, `tsconfig.local.json`, `.npmrc`, `package.json`, `package-lock.json` |
| Scripts e CLI | `local/mutacao.js`, `local/medir-desempenho.js`, `local/cli.js`, `local/gerar-fixtures.js`, `local/app.js`, ajustes no carregador, demo e verificador de sintaxe |
| Testes novos | `auditoria.test.js`, `fornecedores.test.js`, `alteracoes.test.js`, `estoque-fase1.test.js`, `reposicao.test.js`, `catalogo-fase1.test.js`, `leituras.test.js` |
| Dados e documentação | `fixtures/catalogo-seed.json`, `fixtures/SEED_README.md`, README, progresso, decisões, testes, melhorias, este relatório, prompt de continuidade e `docs/evidencias/` |

Os testes existentes receberam os novos campos obrigatórios. A expectativa de tamanho da seed mudou de seis para 40 conforme o contrato da fase. O teste de bloqueio por pendência foi substituído por cobertura do comportamento automático, sem reduzir as asserções sobre consistência. O teste de saldo negativo forjado foi corrigido para alcançar a regra pretendida.

## Ferramentas

Node.js **22.23.5**, npm **10.9.9**, TypeScript **5.9.3**, `@types/node` **22.20.5**, Git **2.56.0** e Python **3.13.16**. O runtime Node temporário já validado da Fase 00 foi reutilizado; nada foi instalado globalmente. `.npmrc` define `bin-links=false` no volume vfat, e o compilador é chamado por `node node_modules/typescript/lib/tsc.js`. Dependências são somente de desenvolvimento e estão fixadas no lockfile.

## Testes e evidências

- Linha de base: 130 testes aprovados, 23 arquivos com sintaxe válida e demonstração aprovada.
- Suíte final: **267 testes aprovados**, sem falhas, cancelados ou ignorados; 34 arquivos com sintaxe válida.
- `npm run typecheck`: ambas as configurações aprovadas, sem supressões de erros.
- `npm run demo`: cadastro, entrada, duplicidade, conflito, rejeições e recálculo independente aprovados; saldo final 10 e um movimento.
- Falhas antes, depois e silenciosas nas três etapas de gravação dos novos casos; repetição não duplica registros.
- Concorrência real: duas jornadas de entradas com oito processos; perdas com oito processos; quatro leitores simultâneos a um escritor com pausa deliberada antes de confirmar.
- Recálculo independente dos 40 saldos por leitura dos JSONL; jornada CLI cobrindo todos os comandos novos.
- `npm run mutacao`: **42 defeitos, 39 detectados e três equivalentes justificados**, sem alvos ausentes ou erro de execução, saída 0. Evidência integral em [mutacao-fase01.txt](evidencias/mutacao-fase01.txt).

A medição reproduziu 90 dias fictícios, 270 movimentos e 329 operações confirmadas. Medianas antes/depois: listar produtos **18,357 / 17,775 ms**; consultar estoque **17,175 / 17,243 ms**; reposição **17,478 / 17,081 ms**; entrada **54,636 / 54,542 ms**. Tempos próximos, sem evidência de ganho expressivo nesse volume. Nenhuma extrapolação para o Google. JSON completos em [antes](evidencias/desempenho-antes.json) e [depois](evidencias/desempenho-depois.json); comandos e metodologia em [TESTES.md](TESTES.md).

## Decisões e limitações

As decisões D-027 a D-034 registram os contratos, o esquema, a derivação de versões, a reconciliação, o custo histórico, a reposição e a medição no fim da fase. Limites atuais:

- Sem interface visual, adaptador Google, menu, execução em Apps Script, vendas, estorno ou automação periódica. O acesso Google não foi reavaliado nesta fase, pois está fora do escopo.
- Reversão compensatória de perda e ajuste adiada para a Fase 2. Não se corrige histórico por edição ou exclusão.
- Bases da Fase 00 não são migradas automaticamente: preservar a pasta antiga e usar outra com `PULSO_DADOS`. Nenhum dado existente foi apagado.
- Uma operação ainda contém somente um registro; M-03 precede vendas.
- Arquivo truncado é detectado, mas não reparado automaticamente. Trava órfã exige inspeção e remoção manual quando não houver processo ativo.
- Não há proteção criptográfica contra alteração coerente de todo o histórico. Não é produto pronto para produção empresarial real.
- A leitura ainda percorre todas as tabelas. A medição cobre apenas o volume declarado, sem simular cotas, concorrência ou células do Google.

## Próxima prioridade

M-06: interface HTML/CSS/JS compatível com HTML Service, apoiada nos casos de uso existentes e pré-visualização local restrita a `127.0.0.1`. Validar teclado, estados e quatro larguras em navegador real. Integração Google só com acesso autorizado efetivo para executar Apps Script e com testes reais separados. Depois, M-03 e Fase 2. O prompt de continuidade foi reescrito para esse estado; ele não foi executado nesta sessão.
