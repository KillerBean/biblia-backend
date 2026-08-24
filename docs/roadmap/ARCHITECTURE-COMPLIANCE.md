# Adequação arquitetural

Projeto: `biblia_backend`
Owner: equipe do produto Bíblia
Perfil: C — aplicação
Nível atual: L2
Nível alvo: L2
Data da avaliação: 2026-08-24

## Controles

- [x] Status e arquitetura documentados
- [x] Runtime e dependências fixados
- [x] CI obrigatório em PR
- [x] Testes exigidos pelo nível
- [x] Secret/dependency/image scan
- [x] Dados e migrations conformes
- [ ] Segurança e threat model conformes
- [x] Logs, métricas, alertas e runbook básico
- [x] Deploy imutável por tag SHA
- [ ] Backup/restore comprovado (não aplicável ao conteúdo read-only no app; validar infraestrutura)

## Exceções/ADRs

| Regra | ADR | Owner | Expira em |
|---|---|---|---|
| Seleção de tradução ainda usa ARC | ADR pendente | equipe Bíblia | definir antes do suporte multi-versão |
| TLS é responsabilidade da VPS/proxy | infraestrutura | equipe de plataforma | revisar na próxima auditoria |

## Próximas três ações

1. Definir contrato de seleção de tradução e retirar o hardcode de ARC.
2. Completar teste de indisponibilidade do Redis no ambiente de integração.
3. Validar TLS, rollback e restore no repositório `production`.
