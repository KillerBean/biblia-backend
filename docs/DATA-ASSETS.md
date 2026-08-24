# Dados de produto

Os bancos SQLite em `src/db/sqlite/` são assets de produto, não fixtures de teste.
Cada arquivo é somente leitura em runtime e deve ser atualizado junto com:

- a licença/permissão informada na tabela `metadata`;
- a versão do conteúdo;
- o checksum SHA-256 e o tamanho no `docs/data-assets.json`.

O CI executa `npm run verify:assets` para impedir alterações acidentais ou
artefatos corrompidos. Para atualizar uma tradução, a origem, a data da
importação e a autorização de distribuição devem ser registradas no pull
request, e o manifesto deve ser regenerado/revisado.

| Arquivo | Tradução | Versão | Permissão | SHA-256 |
|---|---|---:|---|---|
| `ACF.sqlite` | ACF | 1 | SBTB | `7f08ec…f711` |
| `ARC.sqlite` | ARC | 1 | SBB | `e8efc8…c0c2` |
| `KJA.sqlite` | KJA | 1 | Abba Press | `99c5a2…9110` |
| `KJF.sqlite` | KJF | 1 | BVBooks | `6f3572…a4e8` |
| `NTLH.sqlite` | NTLH | 1 | SBB | `f0c60e…f194` |
| `NVI.sqlite` | NVI | 1 | Biblica | `91649b…ed95` |
