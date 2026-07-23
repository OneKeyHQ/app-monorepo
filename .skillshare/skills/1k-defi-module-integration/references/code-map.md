# Earn / DeFi Code Map

Use this as orientation, then confirm current names with `rg`. Directories and
contracts are more durable than a list of exact functions.

## Primary Areas

| Concern                        | Start here                                                                                                                           |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| Earn routes and navigation     | `packages/shared/src/routes/`, `packages/kit/src/routes/Tab/Earn/`, `packages/kit/src/views/Earn/`                                   |
| Native Discovery host          | `packages/kit/src/routes/Tab/Discovery/`, `packages/kit/src/views/Discovery/`, Discovery Jotai context                               |
| Earn portfolio data            | `packages/kit/src/views/Earn/hooks/`, Earn Jotai context, staking/background services                                                |
| Portfolio position UI/actions  | `packages/kit/src/components/DeFi/`, `packages/kit/src/views/Home/components/DeFiListBlock/`, `packages/kit/src/views/AssetDetails/` |
| Borrow                         | `packages/kit/src/views/Borrow/`                                                                                                     |
| Staking operations             | `packages/kit/src/views/Staking/`, `packages/kit-bg/src/services/ServiceStaking.ts`                                                  |
| DeFi build/refresh/persistence | `packages/kit-bg/src/services/ServiceDeFi.ts`, DeFi SimpleDB entity, background API                                                  |
| Shared contracts               | `packages/shared/types/`, `packages/shared/src/utils/`, shared routes and event bus                                                  |

## Useful Searches

Adapt these to the task instead of trusting a frozen anchor list:

```bash
rg -n "supported.*protocol|build-transaction|orderId|approvalTx|permit" \
  packages/kit packages/kit-bg packages/shared
rg -n "claimSymbol|sourcePositions|positionCategory|accountId|indexedAccountId" \
  packages/kit packages/kit-bg packages/shared
rg -n "refresh.*DeFi|DeFiPosition|AccountDataUpdate" \
  packages/kit packages/kit-bg packages/shared
rg --files packages/kit packages/kit-bg packages/shared | \
  rg '(Earn|DeFi|Borrow|Staking).*(test|spec)\.'
```

When request/response semantics decide the fix, inspect the current service
DTO, handler, and representative payload. Record what the field means, not one
temporary implementation snapshot.

## Package Boundaries

Respect the repository import hierarchy:

- `shared` cannot import from other OneKey packages.
- `components` can import only from `shared`.
- `native-components` can import only from `shared` and owns no business state.
- `kit-bg` can import only from `shared` and `core`.
- `kit` can import from `shared`, `components`, `native-components`, and `kit-bg`.
