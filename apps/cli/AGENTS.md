# OneKey Wallet — CLI Agent Skills

When working with the `onekey` CLI, read the skill files before running commands.
Do NOT guess parameters or explore via `--help` — the skills document exact
command signatures, workflows, and security rules.

## Skills

| Skill | Path | Use When |
|---|---|---|
| **Master** | `skills/SKILL.md` | Always read first — pre-flight checks, security rules, routing, parameter conventions |
| **Market** | `skills/onekey-market/SKILL.md` | Token search, price, trending, kline, trades, liquidity |
| **Swap** | `skills/onekey-swap/SKILL.md` | Swap quoting, building, execution, status tracking |
| **Security** | `skills/onekey-security/SKILL.md` | Token security audit, risk classification, transaction simulation |
| **Wallet** | `skills/onekey-wallet/SKILL.md` | Balance, transfer, wallet import, history, logout |

## Quick Start

```bash
# Run the CLI locally (from monorepo)
apps/cli/bin/onekey <command>

# Or if installed globally
onekey <command>
```

Read `skills/SKILL.md` for pre-flight checks, security rules, and the full
skill routing table.
