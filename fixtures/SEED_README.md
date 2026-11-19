# Catálogo sintético da Fase 00

Todos os nomes, preços, custos e limites são inventados. Não representam marcas, cotações ou resultados comerciais.

- Gerador: `local/gerar-fixtures.js`, JavaScript, sem dependências.
- Semente padrão: `27`; algoritmo pseudoaleatório determinístico definido no gerador.
- Saída: `fixtures/catalogo-seed.json`, seis SKUs estáveis (`MER-001` a `MER-006`), um em cada categoria do domínio.
- Preço e custo em centavos inteiros; estoque em unidades inteiras (`UN`).
- Cada produto começa com saldo zero. A seed cadastra produtos e não cria movimentos.

Execute `npm run fixtures` para regenerar o arquivo com a mesma semente. `npm test` compara o arquivo versionado com a saída do gerador e verifica que outra semente produz valores diferentes.

Execute `npm run -s pulso -- seed` para aplicar o catálogo ao armazenamento local. Cada cadastro usa `SEED-CADASTRO-<SKU>` como requisição; reaplicar não duplica produtos. Para testar outra semente, use `gerarCatalogo(semente)` com um diretório de dados novo. Alterar o conteúdo sob a mesma requisição é conflito, não atualização de cadastro.

`npm run demo` usa uma pasta temporária e a remove ao terminar. Para uma jornada manual isolada, defina `PULSO_DADOS` para uma pasta nova; não apague o histórico de outra execução. Após a entrada demonstrativa de 10 unidades em `MER-001`, o saldo esperado é 10 e há exatamente um movimento confirmado, mesmo repetindo a mesma requisição.

O catálogo com 40 produtos, seis fornecedores e histórico de 90 dias continua reservado às fases posteriores.
