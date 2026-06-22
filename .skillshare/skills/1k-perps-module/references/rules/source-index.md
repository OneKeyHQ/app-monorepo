# Perps Source Index

Open when a fact may be stale, SDK/API-versioned, or external to stable rules.

## SDK and official docs

- SDK version: `node -e "console.log(require('./node_modules/@nktkas/hyperliquid/package.json').version)"`
- SDK action source: `node_modules/@nktkas/hyperliquid/src/api/exchange/_methods/`
- OneKey SDK re-export: `packages/shared/types/hyperliquid/sdk.ts`
- Official exchange docs: <https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/exchange-endpoint>

## SDK bump checklist

Raw SDK source/version -> OneKey narrowed types -> service adapters -> targeted utility/action tests before broad runtime claims.

## Repo verification

- Perps app surface: `packages/kit/src/views/Perp/`
- Hyperliquid context: `packages/kit/src/states/jotai/contexts/hyperliquid/`
- Hyperliquid services: `packages/kit-bg/src/services/ServiceHyperLiquid/`
- Perps deposit quote/status owner: `packages/kit-bg/src/services/ServiceSwap.ts`
- Shared Perps utilities/types: `packages/shared/src/utils/perpsUtils.ts`, `packages/shared/types/hyperliquid/`

## Vault decisions

- `Resources/tech/onekey-perps-skill-stable-content-strategy-2026-06-03.md`
- `Resources/tech/onekey-perps-skill-cross-tool-best-practices-2026-06-03.md`
- `Resources/tech/onekey-perps-skill-review-2026-06-06.md`

Do not copy volatile Jira/PR/branch state into this skill. Recheck those at task time.
