# Relatório de execução — Fase 00

**Data da revisão:** 18/11/2026 · **Versão do projeto:** 0.1.0 · **Branch:** `fase-00`

## 1. Resumo

A Fase 00 foi concluída e revisada **no ambiente local**. A execução começou com a leitura integral dos 37 arquivos versionados e do prompt anexado, em um repositório sem alterações locais. A implementação da Fase 00 já existia; foi preservada e corrigida nos pontos de integridade encontrados. O fluxo **cadastro → entrada → consulta de saldo** funciona pela CLI, com **130 testes aprovados**.

A integração com Google Sheets e Apps Script **não foi realizada**. O conector Drive respondeu às buscas `MERCA` e `PULSO` sem arquivos correspondentes, mas não há ferramenta de execução de Apps Script, `clasp` no PATH nem configuração local dele nos caminhos verificados. Não se conclui que o usuário não tenha conta Google. Nenhum recurso externo foi criado, alterado ou publicado.

Os cinco documentos-base e o catálogo foram preservados. O prompt atual limita a execução à Fase 00; as melhorias aprovadas para a próxima sessão e as demais fases seguem pendentes.

## 2. Funcionalidades desenvolvidas

- Cadastro de produto com validação completa e idempotência.
- Registro de entrada auditável, com rejeição de dados inválidos, duplicados e conflitantes.
- Consulta de saldo com mínimo, alvo e histórico de movimentos.
- Listagem de produtos com saldo derivado.
- Reconciliação de operações interrompidas.
- Catálogo sintético reproduzível com 6 produtos, um por categoria.
- Comparação do conteúdo completo após cada gravação, antes da confirmação.
- Validação da intenção pelas regras de domínio e dos vínculos entre eventos do log.
- Saldo limitado ao intervalo de inteiros exatos, na entrada e na leitura.
- Releitura do estado final da reconciliação e mensagem correta em caso de retorno ambíguo.
- Tratamento de escritas parciais em bytes no JSONL.
- Demonstração com asserções e recálculo independente dos arquivos.

## 3. Arquitetura implementada

```text
CLI (local/cli.js)
      │
Casos de uso (src/application/casos-de-uso.js)
      │
Executor de operações: lock, idempotência, intenção → dado → confirmação
      │                         │
Domínio (src/domain)      Repositório e esquema (src/infra)
                                │
              Portas: armazenamento, lock, relógio, gerador de IDs
                                │
              Hoje: JSONL local  │  Futuro: Google Sheets
```

## 4. Arquivos

| Situação | Arquivos |
|---|---|
| Preservados nesta revisão | Cinco documentos-base, `package.json`, `.gitignore`, catálogo e demais fontes/testes existentes |
| Modificados: núcleo | `src/application/casos-de-uso.js`, `src/application/operacoes.js`, `src/infra/repositorio.js` |
| Modificados: local | `local/armazenamento-jsonl.js`, `local/demo.js` |
| Criados | `tests/integridade.test.js`, `fixtures/SEED_README.md` |
| Atualizados: documentação | `README.md`, `docs/PROGRESSO.md`, `docs/DECISOES.md`, `docs/TESTES.md`, este relatório e `docs/PROMPT_PROXIMA_EXECUCAO.md` |

Não foram feitos commits, alterações de branch nem envios remotos. O histórico local existente foi preservado; as mudanças ficam disponíveis no diretório de trabalho para revisão.

## 5. Ferramentas e versões

| Ferramenta | Versão | Observação |
|---|---|---|
| Node.js / npm | 22.23.5 / 10.9.9 | Fora do PATH padrão; cópia oficial temporária em `/tmp/merca27-runtime`, com SHA-256 conferido |
| Git | 2.56.0 | Repositório local, sem remoto |
| Python | 3.13.16 | Conferência do checksum e extração segura do runtime temporário |
| curl | 8.21.0 | Download oficial do Node.js e dos checksums |
| clasp | Ausente | Sem instalação ou autenticação nesta revisão |

Nenhuma dependência de produção ou desenvolvimento foi adicionada. O sandbox padrão não iniciou por restrição do sistema a namespaces; os comandos locais necessários foram executados após aprovação automática da ferramenta.

## 6. Testes e resultados

- Antes das alterações: `npm test`, 112 testes aprovados; `npm run check` e `npm run demo` também passaram.
- Regressões reproduzidas antes da correção: 14 falhas em 15 testes novos; um teste já passava. Depois das primeiras correções, os 15 passaram.
- Após todas as alterações: `npm test`, **130 de 130 aprovados**, sem falhas, cancelados ou ignorados. Os 112 originais foram mantidos e outros três testes completaram a nova cobertura.
- `npm run check`: 23 arquivos, 0 erros de sintaxe.
- `npm run demo`: saldo final 10, um movimento e recálculo independente igual a 10, com asserções aprovadas.
- `npm run fixtures`: catálogo regenerado idêntico ao versionado.
- A suíte incluiu CLI ponta a ponta, reabertura do armazenamento e dois testes de concorrência real com oito processos cada.
- `git diff --check`: sem erros de espaços em branco.
- Testes de mutação da entrega anterior não foram repetidos; sua evidência foi mantida como histórica.

Detalhes em [TESTES.md](TESTES.md).

## 7. Problemas encontrados

| Problema | Resolução |
|---|---|
| Node.js fora do PATH | Runtime oficial temporário, com checksum conferido, sem instalação global |
| Quantidades individualmente válidas podiam gerar soma inexata | Entrada rejeitada antes da intenção e limite conferido na leitura |
| A releitura conferia apenas a existência da chave | Comparação de todos os campos e validação de unicidade antes de confirmar |
| A reconciliação não relia o estado final | Releitura obrigatória e erro em caso de inconsistência |
| Eventos divergentes do log e intenções inválidas podiam ser aceitos | Validação da sequência, dos vínculos e das regras do domínio |
| Escrita curta em JSONL não era completada | Escrita em bytes até completar; ausência de progresso retorna erro |
| Mensagem genérica prometia que nada havia sido confirmado | Mensagem orienta consulta e repetição com a mesma chave, inclusive após retorno ambíguo |

## 8. Decisões

As decisões estão em [DECISOES.md](DECISOES.md). Foram mantidos o núcleo portável (D-002), o armazenamento somente-acréscimo (D-003) e o protocolo de três passos (D-004). D-021 a D-026 registram o escopo desta revisão, a situação Google e os reforços de integridade. Nenhuma mudança de esquema foi necessária.

## 9. Limitações

- O código de `src/` nunca rodou no Apps Script. A portabilidade foi simulada com contexto isolado.
- Não existe adaptador de Sheets, menu nem sidebar. A identidade visual do PULSO ainda não foi aplicada a nenhuma tela.
- Não há edição nem desativação de produto após o cadastro.
- Alteração coerente de todos os registros de uma operação pode não ser detectada; não existe proteção criptográfica ou auditoria externa.
- Cada operação lê todas as tabelas, o que deve ser revisto antes do histórico de 90 dias.
- Trava local órfã exige remoção manual.
- Arquivo truncado é detectado e bloqueado, mas não reparado automaticamente.
- Checagem de tipos, custo por entrada, edição de produto e reconciliação automática continuam em M-01 a M-07, sem implementação nesta revisão.

## 10. Estado atual

| Critério da Fase 00 | Situação |
|---|---|
| 1. Estrutura organizada | Atendido |
| 2. Modelos de Produto e Movimento | Atendido |
| 3. Dados sintéticos reproduzíveis | Atendido |
| 4. Cadastro básico | Atendido |
| 5. Entrada válida gera exatamente um movimento | Atendido |
| 6. Saldo derivado correto | Atendido |
| 7. Duplicadas não alteram o resultado | Atendido |
| 8. Entradas inválidas rejeitadas | Atendido |
| 9. Regras críticas com testes | Atendido |
| 10. Documentação fiel ao estado real | Atendido |
| Integração Google | **Pendente** |

## 11. Próxima prioridade

Seguir a ordem aprovada em [MELHORIAS_PLANEJADAS.md](MELHORIAS_PLANEJADAS.md): começar por M-07 (JSDoc e checagem de tipos), depois M-01, M-02, M-04 e M-05. Confirmar um runtime Node.js disponível na nova sessão. Validar a integração somente quando houver acesso para executar Apps Script; a mera presença do conector Drive não basta.

**Critério da próxima melhoria:** `npm run typecheck` aprovado em `src/` e `local/`, núcleo sem dependência de Node e toda a suíte preservada. Quando houver integração Google, repetir o cenário obrigatório na planilha real e registrar evidência separada.

## 12. Adendo pós-entrega

As sete melhorias aprovadas na entrega anterior continuam descritas em [MELHORIAS_PLANEJADAS.md](MELHORIAS_PLANEJADAS.md), sem itens marcados como concluídos nesta revisão. [PROMPT_PROXIMA_EXECUCAO.md](PROMPT_PROXIMA_EXECUCAO.md) foi atualizado com o estado real, os 130 testes e os pontos que precisarão ser ampliados na validação do repositório ao introduzir novos tipos de operação.
