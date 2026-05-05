# OneKey Wallet — CLI Agent Skills

When working with the `onekey` CLI, use the schema command for exact signatures and install the external skill pack when you need guided workflows.
Do NOT guess parameters or explore via `--help`.

## External Skills Repo

CLI skills have moved to the standalone repo:
https://github.com/OneKeyHQ/onekey-wallet-skills

Install them in Claude with:

```bash
/plugin marketplace add OneKeyHQ/onekey-wallet-skills
/plugin install onekey-wallet-skills
```

Use `onekey schema <cmd>` for exact command parameters.

## Quick Start

```bash
# If installed globally
onekey <command>
```

The external skill pack contains pre-flight checks, security rules, and workflow conventions for wallet, swap, market, and security tasks.
