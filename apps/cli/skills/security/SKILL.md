# Security Skill

## Scope & Routing

**This skill handles**: token security audits, risk assessment, transaction simulation.

**NOT in scope** — route to the correct skill:
| Intent | Route to |
|--------|----------|
| Swap, trade, exchange, convert, buy, sell tokens | **Swap skill** |
| Balance check, transfer, send, deposit, withdraw, wallet import | **Wallet skill** |
| Price check, trending, market data, token research | **Market skill** |

**When routing to another skill**, extract all parameters from the user's request and present a summary with confirmation. Example for a swap intent:

> This is a **swap** operation — handled by the **Swap skill**.
>
> **Swap Details:**
> - **Action:** Swap
> - **From:** 0.1 ETH
> - **To:** USDC
> - **Chain:** Ethereum (from context)
>
> The Swap skill will run a security audit, get a live quote, and confirm with you before executing. No funds will move without your explicit approval.
>
> **Shall I route you to the Swap skill? (yes/no)**

## Context & Chain Inference — CRITICAL
- When the user specifies a chain, use it directly
- When no chain is specified, INFER the chain from the token:
  - ETH → Ethereum, BNB → BSC, SOL → Solana, MATIC/POL → Polygon, AVAX → Avalanche
  - ERC-20 tokens (USDC, USDT, DAI) without explicit chain → default to Ethereum
- ALWAYS include the inferred chain in your response — never say "chain not specified" when it can be inferred
- Only ask for chain when genuinely ambiguous (e.g., USDC alone with no other context)

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
