# Catálogo sintético da Fase 01

Todos os nomes, preços, custos e limites são inventados. Não representam marcas, cotações ou resultados comerciais.

- Gerador: `local/gerar-fixtures.js`, JavaScript, sem dependências.
- Semente padrão: `27`; algoritmo pseudoaleatório determinístico definido no gerador.
- Saída: `fixtures/catalogo-seed.json`, 40 SKUs estáveis (`MER-001` a `MER-040`) em seis categorias, com seis fornecedores fictícios (`FOR-001` a `FOR-006`).
- Preço e custo em centavos inteiros; estoque em unidades inteiras (`UN`).
- Cada produto começa com saldo zero. A seed cadastra produtos e não cria movimentos.

Execute `npm run fixtures` para regenerar o arquivo com a mesma semente. `npm test` compara o arquivo versionado com a saída do gerador e verifica que outra semente produz valores diferentes.

Execute `npm run -s pulso -- seed` para cadastrar os seis fornecedores e depois os 40 produtos. Requisições: `SEED-FORNECEDOR-<ID>` e `SEED-CADASTRO-<SKU>`; reaplicar não duplica. Cada SKU usa o fornecedor da categoria, por índice fixo, sem consumir aleatoriedade. Para outra semente, use `gerarCatalogo(semente)` com outro diretório de dados. Alterar conteúdo sob a mesma requisição é conflito; a edição de produto usa o caso de uso próprio.

`npm run demo` usa uma pasta temporária e a remove ao terminar. Para uma jornada manual isolada, defina `PULSO_DADOS` para uma pasta nova; não apague o histórico de outra execução. Após a entrada demonstrativa de 10 unidades em `MER-001`, o saldo esperado é 10 e há exatamente um movimento confirmado, mesmo repetindo a mesma requisição.

Os seis produtos da Fase 00 mantêm exatamente nome, preço, custo, mínimo e alvo, fixados em `tests/catalogo-fase1.test.js`. Nenhuma transação histórica é gerada pela seed. O cenário de 90 dias é separado, temporário e voltado à medição de desempenho; não representa vendas reais nem dados de mercado.

O formato de movimentos da Fase 01 inclui custo, fornecedor, categoria de perda e saldos de ajuste. Bases anteriores não são migradas nem apagadas automaticamente. Preserve-as e escolha uma pasta nova com `PULSO_DADOS`. Perdas e ajustes usam o custo de referência vigente; entrada exige custo unitário explícito e fornecedor. Saldo inicial exige quantidade positiva e motivo e só pode ocorrer antes de movimentos confirmados.
