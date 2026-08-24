# Arquitetura — Bíblia Backend

## Classificação

- **Status:** produto ativo em produção
- **Owner:** equipe do produto Bíblia
- **Perfil:** C — aplicação
- **Nível atual/alvo:** L2
- **Runtime:** Node.js 24 no container, TypeScript ESM executado por `tsx`

## Fronteiras e dependências

```text
Cliente → Nginx → Express → Redis (cache opcional) → SQLite (conteúdo)
```

O backend é um monólito modular read-only e stateless. Controllers encapsulam
acesso aos dados, o router expõe o contrato HTTP e middlewares tratam cache,
segurança, rate limit e correlação de requests. Redis não é fonte de verdade:
quando indisponível, a API continua podendo responder diretamente do SQLite.

## Gates L2

O CI executa, nesta ordem, lint, typecheck/build, testes HTTP, verificação dos
assets, auditoria de dependências e scan da imagem. O mesmo conjunto de checks
é usado antes do deploy de produção.

## Dados

As traduções SQLite são assets versionados e somente leitura. Origem,
permissão, versão e checksum estão em [`DATA-ASSETS.md`](../DATA-ASSETS.md).
Não há migration automática durante `build`; a inicialização de índices é um
passo explícito da imagem.

## Decisões e pendências

- A tradução ativa permanece ARC até que o contrato HTTP de seleção de versão
  seja definido (P2 do plano).
- TLS termina na infraestrutura/VPS e não neste processo; a configuração deve
  ser validada no repositório `production`.
