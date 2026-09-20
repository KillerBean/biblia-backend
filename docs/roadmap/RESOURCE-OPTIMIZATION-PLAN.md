# Plano de Otimização de Recursos

**Projeto:** `biblia_backend`
**Data-base:** 2026-09-07
**Prioridade:** baixa, após Cardápio QR, Fluxo Nobre e PostgreSQL.

## Objetivo e baseline

Reduzir RAM, CPU, tamanho da imagem e I/O sem alterar respostas da API. A
arquitetura continuará com uma instância Express, Redis e seis bases SQLite
imutáveis, servidas em modo somente leitura.

Baseline conhecido na VPS: aplicação em aproximadamente 39 MiB de RAM, pico de
164 MiB e 73 MiB de swap; Redis em aproximadamente 5 MiB. Confirmar por sete
dias requests/minuto, P50/P95/P99, event-loop lag, heap/RSS, reinícios, cache
hit/miss, uso do Redis e latência das consultas SQLite.

## Ordem de implementação

### 1. Observabilidade sem conteúdo sensível

- Ampliar o log estruturado com duração, status, rota parametrizada,
  `requestId` e `X-Cache`, sem URL de busca, IP bruto ou conteúdo bíblico.
- Expor métricas agregadas de heap/RSS, event-loop lag, cache hit, erro Redis e
  duração SQLite. Manter cardinalidade limitada por rota.
- Executar testes de carga em ambiente isolado para `/`, livros, capítulos,
  versículos e busca; registrar cold/warm cache separadamente.

### 2. Runtime e imagem

- Compilar TypeScript no builder e iniciar o runtime com `node dist/index.js`,
  removendo `tsx`, `npx` e dependências de desenvolvimento da imagem final.
- Preservar imagem multi-stage, usuário não-root, bases já indexadas e build no
  GitHub Actions. Comparar tamanho da imagem, startup, RSS e CVEs antes/depois.
- Manter uma única réplica enquanto rate limit e outros estados em processo não
  forem externalizados e a carga não justificar escala horizontal.

### 3. SQLite e respostas

- Medir page-cache antes de reduzir o `PRAGMA cache_size` atual de 64 MiB;
  testar 16 e 32 MiB e escolher o menor valor sem piorar P95 em mais de 5%.
- Comparar `temp_store=MEMORY` com o padrão em buscas de maior resultado; não
  trocar segurança por ganho não mensurável.
- Auditar projeções e limites de busca para impedir respostas e serializações
  sem limite. Preservar índices gerados e `OPEN_READONLY`.
- Reutilizar statements somente se o benchmark comprovar redução de CPU e os
  testes de concorrência confirmarem uso seguro.

### 4. Redis e cache HTTP

- Manter TTL padrão de uma hora e chave com hash, medindo taxa de acerto por
  rota e tamanho das entradas.
- Não armazenar resposta acima do limite definido pelo benchmark; impedir que
  buscas únicas expulsem conteúdo popular em massa.
- Fixar `maxmemory` inicial em 32 MiB com `allkeys-lru`, elevando apenas se a
  taxa de evicção prejudicar o P95. Validar degradação quando Redis estiver
  indisponível.
- Revisar compressão e cache headers no Nginx sem cachear erros ou respostas
  privadas.

## Gates e metas

Cada etapa deve passar por `npm run lint`, `npm run typecheck`, `npm test`,
`npm run verify:assets`, build/scan da imagem e teste de carga reproduzível.
Validar todas as traduções, parser de referências, busca, cache miss/hit,
indisponibilidade do Redis, shutdown e health check.

Metas iniciais sob a mesma carga: RSS P95 até 64 MiB, pico até 128 MiB, Redis
até 32 MiB, zero OOM/restart e P95 sem regressão superior a 5%. Uma mudança por
imagem SHA; observar 30 minutos, 2 horas e 24 horas. Rollback consiste em
reaplicar o digest anterior, sem reconstrução na VPS.
