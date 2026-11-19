# Relatório de execução — Fase 2

**Data:** 19/11/2026 · **Branch:** `fase-02-vendas` · **Ambiente:** local, com dados sintéticos.

## Resultado e escopo

Venda de vários itens, histórico, detalhe e estorno total foram implementados no núcleo, na CLI e na interface Angular. As Fases 00/01 e M-03 foram preservadas. M-06 continua **parcial**, pois faltam navegador real, teclado de ponta a ponta e capturas nas larguras 360, 390, 768 e 1440 px. Não houve execução em Google Sheets/Apps Script, publicação, push ou alteração de dados existentes.

A sessão encontrou a branch já criada, com implementação de vendas ainda sem commit e uma medição anterior no diretório. Esse trabalho foi preservado, lido e completado. A linha de base real do diretório tinha **494 testes aprovados**, acima dos 421 do marco M-03 citado pelo prompt. Os cinco documentos-base v1.1.0 ficaram intactos. Seus estados e contagens desatualizados continuam sendo divergências históricas (D-054); os relatórios e o código executado descrevem o estado atual.

## Funcionalidades

- `confirmarVenda`: 1–50 itens, SKU repetido recusado, ordem canônica, quantidade inteira positiva, pagamento fictício DINHEIRO/PIX/CARTAO, observação opcional e operador simulado. Verifica tudo sob trava; se faltar saldo em um item, nada é vendido. Captura preço e custo vigentes; total e custo estimado usam centavos inteiros exatos.
- `estornarVenda`: motivo obrigatório, total e único por venda, devolução integral das unidades com o custo capturado original. Mantém venda e itens imutáveis. Repetição é idempotente; nova chave de venda já estornada retorna `VENDA_JA_ESTORNADA`. A devolução é recusada por inteiro se algum saldo excederia o limite de unidades exatas.
- `listarVendas`: confirmadas, em ordem inversa das operações, com estado derivado do estorno; período ISO UTC com início inclusivo e fim exclusivo. Padrão 100 resultados, limite até 500. Datas inexistentes e período invertido são recusados.
- `consultarVenda`: por `vendaId` ou `requisicaoId`, exatamente um; itens, valores históricos, movimentos de venda/estorno e motivo do estorno. Pendências não entram nos saldos nem no histórico efetivo.
- CLI: `venda --item SKU=QTD --pagamento PIX`, `vendas`, `venda --id ID` (ou `ver-venda`), `estorno --venda ID --motivo "..."`.
- Interface: busca de produtos, vários itens, revisão antes da confirmação, BRL, total oficial retornado pelo núcleo, histórico e detalhe com estorno. Estados de carregamento, vazio, recusa, sucesso, incerteza, conflito e pendência usam o transporte existente. Sucesso bloqueia outra venda até “Nova venda”; repetir uma falha incerta mantém chave/dados e atualiza o comprovante e o detalhe.

## Dados e compatibilidade

Foram acrescentadas `VENDAS`, `ITENS_VENDA` e `ESTORNOS_VENDA`, nas ordens fixas de colunas de D-056/D-057 e de `src/infra/esquema.js`. Não há coluna de estado mutável na venda. A intenção lista venda, itens e movimentos; o estorno lista seu registro e os movimentos positivos. Cada escrita é relida, e só o conjunto completo permite confirmar.

O repositório passou a conferir origem, presença e conteúdo nas oito tabelas, reconstruir vendas/estornos e reproduzir disponibilidade, valores e unicidade do estorno na ordem do log. `TIPOS_LEGADOS` conserva os sete tipos antigos; os tipos novos exigem `{ registros }`. Tabelas novas ausentes valem zero vendas. A base versionada da Fase 01 não foi editada; os testes continuam comprovando a preservação byte a byte e a reconciliação de sua pendência. Bases no formato M-03 são exercitadas pelas operações e pela suíte de contagem, com vendas adicionadas sobre o mesmo protocolo.

Uma conferência adicional gerou uma base com o código original de M-03 (`18e7f01`, extraído em `/tmp`), incluindo contagem de dois SKUs. O núcleo atual consultou, vendeu e estornou nessa base; todos os prefixos de arquivos antigos ficaram preservados. Evidência em [fumaca-fase02.json](evidencias/fumaca-fase02.json).

## Defeitos encontrados e corrigidos

| Defeito observado na revisão | Correção e evidência |
|---|---|
| Confirmar novamente depois do sucesso criava outra tentativa | Formulário e confirmação encerrados até “Nova venda”; teste de novo submit sem gravação |
| Repetição pelo aviso compartilhado não atualizava comprovante/estorno | Apresentação e recarga observam o sucesso do controle, inclusive repetição; teste conserva chave/pedido |
| Estorno podia persistir devolução acima do limite de unidades | Recusa antes da intenção, testada com saldo `MAX_SAFE_INTEGER` |
| IDs literais de `Campo` também apareciam no wrapper Angular | Remoção do id do wrapper; teste de unicidade e associação dos rótulos |
| Formulário do estorno não ligava `ngSubmit` à diretiva de formulário | Adicionado `FormGroup`; teste clica no botão real e só recarrega após confirmação |
| Filtro de período aceitava datas impossíveis | ISO canônico e ordem do intervalo validados, sem escrita |

## Verificações executadas

Node **22.23.5**, npm **10.9.9**, TypeScript **5.9.3** no núcleo; Angular **22.3.0**, TypeScript **6.0.3** e Tailwind **4.3.5** na interface. Reutilizado runtime temporário; nenhuma instalação global. `npm ci --ignore-scripts --no-audit --no-fund` e `npm run interface:instalar` concluídos. A instalação da interface levou cerca de 14 minutos; tentativas durante a extração falharam por dependências parciais e foram repetidas após a conclusão, sem supressão de tipos.

| Controle | Resultado |
|---|---|
| `npm test` | 507 aprovados, zero falhas, cancelados ou ignorados |
| `npm run check` | 45 arquivos, zero erros |
| `npm run typecheck` | Duas configurações aprovadas |
| `npm run demo` | Saldo 10, um movimento e recálculo independente 10 |
| `npm run interface:typecheck` | Aprovado com strict e strictTemplates |
| `npm run interface:test` | 51 aprovados em 6 arquivos |
| `npm run interface:build` | HTML único, 434.763 bytes (424,6 KiB), sem chunks externos |
| `npm run mutacao -- --verificar-alvos` | 163 alvos únicos |
| `npm run mutacao` | 163 defeitos, 157 detectados, seis equivalentes justificados, zero erros; saída 0 |
| `npm run interface:mutacao` | 26 defeitos, 26 detectados por testes, zero problemas; saída 0 |
| Fumaça HTTP com HTML real | GET 200 com CSP/shim; 40 produtos; venda de dois itens/2.108 centavos e estorno após perda de resposta, sem duplicação; saldos finais 10/10 |

Após as duas baterias, todos os controles foram repetidos sem mutações e aprovados com os mesmos números e tamanho de HTML. Síntese em [validacao-fase02.json](evidencias/validacao-fase02.json). `git diff --check` passou; comparação com `18e7f01` confirmou documentos-base, catálogo e fixture antiga inalterados.

A bateria do núcleo está em [mutacao-fase02.txt](evidencias/mutacao-fase02.txt). Equivalentes: MUT-10, MUT-11, MUT-37, MUT-115, MUT-123 e MUT-155; justificativas em TESTES.md e D-062. A bateria da interface está em [mutacao-interface-fase02.txt](evidencias/mutacao-interface-fase02.txt). Compilação ou erro de execução não contam como detecção. Ambas rodaram em sequência, sem cargas pesadas paralelas.

## Desempenho medido

O arquivo `desempenho-fase02-antes.json` já existia no início e foi preservado. Para uma comparação reproduzível nesta revisão, o commit M-03 `18e7f01` foi extraído para uma pasta temporária e medido com o mesmo runtime. Essa referência foi reexecutada **após** as alterações no diretório, mas com o código antigo isolado; não é uma alegação de medição anterior à sessão. Depois foi medido o código atual, em sequência e sem testes/builds/mutações concorrentes.

Ambos geram 90 dias sintéticos: 40 produtos, 6 fornecedores, 270 movimentos, 13 alterações e 658 eventos iniciais. Cada caso tem três aquecimentos e 20 amostras. O script mede consultas e escritas sequencialmente, portanto o volume cresce; vendas são medidas após o cenário de estoque, e consultas de vendas após 23 vendas de três itens. Estornos usam cada uma dessas vendas uma vez.

| Caso | Mediana M-03 / Fase 2 (ms) | Leituras M-03 / Fase 2 |
|---|---:|---:|
| Listar produtos | 17,379 / 18,381 | 5 / 8 |
| Consultar estoque | 17,362 / 18,968 | 5 / 8 |
| Consultar reposição | 17,068 / 17,438 | 5 / 8 |
| Entrada | 44,301 / 57,705 | 8 / 11 |
| Contagem de cinco SKUs | 67,510 / 73,108 | 12 / 15 |
| Venda de três itens | — / 76,366 | — / 17 |
| Listar vendas | — / 30,805 | — / 8 |
| Consultar venda | — / 29,375 | — / 8 |
| Estornar três itens | — / 89,810 | — / 14 |

As três tabelas acrescentam três leituras por carregamento. O custo ficou explícito; não foi retirado nenhum controle de releitura. Os tempos variam com volume e ambiente; não indicam desempenho ou cotas do Google. JSON integrais: [referência M-03](evidencias/desempenho-fase02-base-m03.json) e [Fase 2](evidencias/desempenho-fase02-depois.json).

Os testes novos cobrem T05–T11, T15, T18/T19, o exemplo de saldo 3 recusando venda de 4, integridade dos totais e movimentos, cada posição dos registros com falhas antes/depois/silenciosas, recuperação sem duplicação, adulterações e bases anteriores. Processos reais disputam saldo (inclusive duas vendas de seis sobre saldo dez), repetem a mesma venda e disputam um único estorno. Há 12 testes novos de componentes para as telas de vendas, além dos 39 existentes.

## Arquivos e commits

Núcleo: novo `src/domain/venda.js`; alterações em casos de uso, executor, despacho, esquema, repositório, composição e `tipos/contratos.d.ts`. Local: CLI, medição e mutações. Testes: novo `tests/vendas.test.js` e atualização dos contratos das tabelas nas suítes existentes.

Interface: novas páginas `venda-nova.ts`, `vendas.ts` e testes `vendas.spec.ts`; rotas, menu, contratos, fachada API, classificação de recusas, rótulos e `Campo`. Documentação: README, decisões, testes, progresso, melhorias, relatório da interface e prompt da próxima execução.

Commits locais: `5ddf0fe` (núcleo/CLI), `a19193a` (interface) e `f8fc6a1` (testes, ferramentas e evidências). A documentação é registrada em seguida na mesma branch. Não há remoto configurado.

## Limitações e próximo passo

O estorno assume todos os itens revendáveis. Reversão de perdas/ajustes/contagens continua adiada para uma fatia própria (D-058). A busca visual filtra a lista carregada; detalhe de qualquer ID pode ser aberto diretamente. A chave sobrevive à navegação durante a sessão, mas não ao recarregamento do navegador (D-045).

Continuam os limites conhecidos: leitura integral das tabelas, trava órfã com recuperação manual, arquivo truncado detectado sem reparo automático e ausência de proteção criptográfica contra alteração coerente de todo o histórico. O sistema é uma demonstração de portfólio.

Próxima fase: dashboard e automações, conforme `PROMPT_PROXIMA_EXECUCAO.md`, com política temporal explícita para estornos, métricas reconciliáveis e nenhuma integração ou notificação externa presumida. A validação de M-06 continua pendente e deve ser concluída quando houver um caminho de navegador autorizado e disponível.
