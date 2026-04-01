# OneKey Wallet — CLI Agent Skills

When working with the `onekey` CLI, read the skill files before running commands.
Do NOT guess parameters or explore via `--help` — the skills document exact
command signatures, workflows, and security rules.

## Skills

| Skill | Path | Use When |
|---|---|---|
| **Wallet** | `skills/wallet/SKILL.md` | Balance, transfer, wallet import, history, logout |
| **Swap** | `skills/swap/SKILL.md` | Swap quoting, building, execution, status tracking |
| **Market** | `skills/market/SKILL.md` | Token search, price, trending, kline, trades, liquidity |
| **Security** | `skills/security/SKILL.md` | Token security audit, risk classification, transaction simulation |

## Quick Start

```bash
# Run the CLI locally (from monorepo)
apps/cli/bin/onekey <command>

# Or if installed globally
onekey <command>
```

Each skill file includes pre-flight checks, security rules, and parameter
conventions. Read the relevant skill for your task.
