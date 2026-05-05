# OneKey Wallet — CLI Agent Skills

When working with the `onekey` CLI, use the schema command to understand commands and install the external skill pack when you need guided workflows.

## Interface Discovery (Primary)
- `onekey schema <cmd>` — exact input/output JSON Schema for any command
- `onekey schema --list` — all available commands
- `onekey schema --all` — full registry dump
- `apps/cli/cli-api.d.ts` — TypeScript types for full API surface

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
