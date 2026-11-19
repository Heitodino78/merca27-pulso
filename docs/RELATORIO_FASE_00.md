# Relatório de execução — Fase 00

**Data:** 18/11/2026 · **Versão:** 0.1.0 · **Branch:** `fase-00`

## 1. Resumo

A Fase 00 foi concluída **no ambiente local**. O fluxo **cadastro → entrada → consulta de saldo** funciona de ponta a ponta pela linha de comando, com 112 testes aprovados. A integração com Google Sheets e Apps Script **não foi realizada**, porque não há conta autorizada nesta máquina.

## 2. Funcionalidades desenvolvidas

- Cadastro de produto com validação completa e idempotência.
- Registro de entrada auditável, com rejeição de dados inválidos, duplicados e conflitantes.
- Consulta de saldo com mínimo, alvo e histórico de movimentos.
- Listagem de produtos com saldo derivado.
- Reconciliação de operações interrompidas.
- Catálogo sintético reproduzível com 6 produtos, um por categoria.

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
| Movidos sem alteração de conteúdo (checksums conferidos) | Cinco documentos-base, da raiz para `docs/` |
| Criados: núcleo | `src/pulso.js`, `src/domain/*`, `src/application/*`, `src/infra/*` |
| Criados: local | `local/*`, `fixtures/catalogo-seed.json` |
| Criados: testes | `tests/*` |
| Criados: projeto | `README.md`, `package.json`, `.gitignore` |
| Criados: documentação | `docs/PROGRESSO.md`, `docs/DECISOES.md`, `docs/TESTES.md`, este relatório e `docs/PROMPT_PROXIMA_EXECUCAO.md` |

## 5. Ferramentas e versões

| Ferramenta | Versão | Observação |
|---|---|---|
| Node.js / npm | 24.22.3 / 11.19.1 | **Não está instalado no sistema.** Foi usada uma cópia oficial temporária, com checksum conferido |
| Git | 2.56.0 | Repositório local, sem remoto |
| Python | 3.13.16 | Usado só no script temporário de mutação |
| clasp | Ausente | Não instalado, pois não há conta autorizada |

## 6. Testes e resultados

- Sintaxe: 22 arquivos, 0 erros.
- Automatizados: 112 de 112 aprovados, em três execuções seguidas.
- Mutação: 32 de 35 defeitos detectados; os outros 3 não alteram o comportamento.
- Concorrência real: 8 processos simultâneos sem duplicidade nem perda.

Detalhes em [TESTES.md](TESTES.md).

## 7. Problemas encontrados

| Problema | Resolução |
|---|---|
| Node.js ausente | Cópia oficial temporária usada apenas para os testes |
| Log bloqueado quando a confirmação era gravada com erro de retorno | Corrigido e coberto por teste (D-006) |
| Duas lacunas de teste reveladas por mutação: saldo com vários SKUs e saldo negativo forjado | Testes adicionados |

## 8. Decisões

As 13 decisões e os acréscimos ao esquema estão em [DECISOES.md](DECISOES.md). As centrais são o núcleo portável (D-002), o armazenamento somente-acréscimo (D-003) e o protocolo de gravação em três passos (D-004).

## 9. Limitações

- O código de `src/` nunca rodou no Apps Script. A portabilidade foi simulada com contexto isolado.
- Não existe adaptador de Sheets, menu nem sidebar. A identidade visual do PULSO ainda não foi aplicada a nenhuma tela.
- Não há edição nem desativação de produto após o cadastro.
- A exclusão coerente de uma operação inteira não é detectável.
- Cada operação lê todas as tabelas, o que deve ser revisto antes do histórico de 90 dias.
- Trava local órfã exige remoção manual.

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

Instalar o Node.js 22 ou superior e, com uma conta Google autorizada, validar o núcleo no Apps Script antes de ampliar o domínio. Sem essa conta, seguir com a Fase 1 local.

**Critério de aceite:** repetir o cenário obrigatório na planilha real com o mesmo resultado dos testes locais.

## 12. Adendo pós-entrega

Após esta entrega, o proprietário aprovou sete melhorias, descritas em [MELHORIAS_PLANEJADAS.md](MELHORIAS_PLANEJADAS.md). Elas ainda não foram implementadas e passam a definir a ordem da próxima execução, em [PROMPT_PROXIMA_EXECUCAO.md](PROMPT_PROXIMA_EXECUCAO.md).
