# OneKey Wallet — CLI Agent Skills

When working with the `onekey` CLI, use the schema command and skill files to understand commands.

## Interface Discovery (Primary)
- `onekey schema <cmd>` — exact input/output JSON Schema for any command
- `onekey schema --list` — all available commands
- `onekey schema --all` — full registry dump
- `apps/cli/cli-api.d.ts` — TypeScript types for full API surface

## Skills (Framework & Security)

| Skill | Path | Use When |
|---|---|---|
| **Wallet** | `skills/wallet/SKILL.md` | Balance, transfer, wallet import, history, logout |
| **Swap** | `skills/swap/SKILL.md` | Swap quoting, building, execution, status tracking |
| **Market** | `skills/market/SKILL.md` | Token search, price, trending, kline, trades, liquidity |
| **Security** | `skills/security/SKILL.md` | Token security audit, risk classification, transaction simulation |

Skills contain security rules, workflows, and domain knowledge.
For exact command parameters, use `onekey schema <cmd>`.

## Quick Start

```bash
# Run the CLI locally (from monorepo)
apps/cli/bin/onekey <command>

# Or if installed globally
onekey <command>
```
