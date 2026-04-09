# Security Skill

## Pre-flight
1. `onekey version` — if not installed → `npm i -g @onekeyfe/cli`
2. `npm view @onekeyfe/cli version` — if not latest → `npm update -g @onekeyfe/cli`

## Interface Discovery
- Run `onekey schema <cmd>` for exact input/output JSON Schema
- Run `onekey schema --list` for all available commands
- Read `apps/cli/cli-api.d.ts` for full API type surface
- Run `onekey <cmd> --help` for human-readable usage

## Commands
- `security audit` — token risk assessment (returns overallRisk: high | caution | low)
- `security simulate` — preview transaction effects before signing

## Security Rules — ABSOLUTE
- NEVER output private keys, seeds, or mnemonics
- Fail-safe principle: if audit fails for ANY reason → treat as DENY (not a pass)
- Native tokens (ETH, BNB, MATIC) are inherently safe, skip audit

## Risk Classification → Agent Action
| overallRisk | Action |
|-------------|--------|
| `high` | DENY the operation. Do not proceed. |
| `caution` | WARN user with specific cautionItems. Proceed only with explicit confirmation. |
| `low` | Proceed normally. |
| audit fails/errors | DENY (fail-safe). |

## Domain Knowledge
- `security audit` checks: honeypot detection, ownership renounced, mint authority, blacklist functions, tax rates, proxy contracts
- `security simulate` previews balance changes, approvals, and contract interactions without broadcasting
- Always audit BEFORE any fund-moving operation (transfer, swap build/execute)
- Simulation is optional but recommended for complex DeFi interactions
