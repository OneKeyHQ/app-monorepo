# DeFi Test Map

Use explicit Jest paths with `--runInBand`. Add focused tests beside changed
owners when the required lifecycle or persistence transition is not covered.

## AssetDetails Lending Action

```bash
yarn jest \
  packages/kit/src/components/DeFi/protocolLendingActionUtils.test.ts \
  packages/kit/src/components/DeFi/protocolPositionActionPercentUtils.test.ts \
  packages/kit/src/components/DeFi/protocolPositionActionErrorUtils.test.ts \
  packages/kit/src/components/DeFi/protocolPositionActionLayoutUtils.test.ts \
  packages/kit/src/views/Borrow/components/ManagePosition/hooks/useBorrowApproveAndSubmit.test.tsx \
  packages/kit/src/views/Borrow/hooks/useUniversalBorrowHooks.test.tsx \
  --runInBand
```

Required cases when the action lifecycle changes:

- native modal-route/page and extension/desktop dialog share business content
- 100% amount is replaceable; iOS keyboard can dismiss
- native token, amount/decimals, `bps=10000`, and source metadata are correct
- approval closes or hands off before business confirmation
- success/fail/cancel all release duplicate-submit protection
- `orderId` receives broadcast tx hash, final status settles, and success
  triggers immediate/delayed refresh

If the existing tests do not cover the full lifecycle, create focused tests for
the touched hook rather than inferring it from resolver tests.

Canonical new lifecycle target and final command:

```bash
yarn jest \
  packages/kit/src/views/Borrow/hooks/useUniversalBorrowWithdrawRepayHooks.test.tsx \
  packages/kit/src/views/Borrow/components/ManagePosition/hooks/useBorrowApproveAndSubmit.test.tsx \
  packages/kit/src/components/DeFi/protocolLendingActionUtils.test.ts \
  packages/kit/src/components/DeFi/protocolPositionActionPercentUtils.test.ts \
  --runInBand
```

Create `useUniversalBorrowWithdrawRepayHooks.test.tsx` when the touched action
sequence lacks coverage. It should own approval/business handoff, tx-hash to
`orderId`, settle callbacks, success refresh, and fail/cancel guard release.

## Portfolio Action Resolution And Payloads

```bash
yarn jest \
  packages/shared/src/utils/defiActionUtils.test.ts \
  packages/shared/src/utils/defiPositionMetadataUtils.test.ts \
  packages/kit/src/utils/defiPositionUtils.test.ts \
  packages/kit/src/components/DeFi/protocolProviderDisplayUtils.test.ts \
  packages/kit/src/views/Home/components/DeFiListBlock/ProtocolUnifiedTableUtils.test.ts \
  --runInBand
```

Protect outer position category vs inner asset category, grouped source
metadata, missing-action visibility, protocol/provider display, and each
required build payload field.

## All Networks, Refresh, And Persistence

```bash
yarn jest \
  packages/kit-bg/src/services/ServiceDeFi.getAccountTotalDeFiNetWorth.test.ts \
  packages/kit-bg/src/dbs/simple/entity/SimpleDbEntityOrphanCleanup.test.ts \
  packages/kit/src/views/Home/components/DeFiListBlock/DeFiListBlock.loading.test.ts \
  --runInBand
```

For changes to refresh/persistence, add focused tests for:

- `ServiceDeFi.refreshAccountDeFiPositionsAfterAction`: immediate plus 40s/80s
  schedule, account/network-keyed coalescing, failed-tx skip, and UI-abort
  independence
- `SimpleDbEntityDeFi`: per-account/per-network write and manual quota atomicity
- `DeFiListBlock`: cold hydration, current/loaded owner keys, A -> B stale-event
  rejection, and matching `DeFiPositionRefreshed` reconciliation

Canonical new targets and final command:

```bash
yarn jest \
  packages/kit-bg/src/services/ServiceDeFi.refreshAccountDeFiPositionsAfterAction.test.ts \
  packages/kit-bg/src/dbs/simple/entity/SimpleDbEntityDeFi.test.ts \
  packages/kit/src/views/Home/components/DeFiListBlock/DeFiListBlock.refreshOwner.test.tsx \
  packages/kit-bg/src/services/ServiceDeFi.getAccountTotalDeFiNetWorth.test.ts \
  --runInBand
```

Create the first three files when their owners change; do not claim that the
adjacent baseline command covers refresh scheduling, quota atomicity, or owner
reconciliation.

Run the new files explicitly in the final command. Static tests do not replace
the restart/account-switch runtime matrix in [runtime-boundaries.md](runtime-boundaries.md).

## External Discovery DApp Boundary

```bash
yarn jest packages/kit/src/states/jotai/contexts/discovery/actions.test.tsx --runInBand
```

Runtime pass:

- opening the URL renders the actual Discovery WebView URL/title/content
- website-only interaction opens no internal DeFi action modal
- only a website chain RPC can open DApp signature confirmation
- no internal `ServiceDeFi` build, DeFi pending row, or portfolio refresh is
  invented for an external-only flow

## Runtime Evidence

Capture the real route/platform plus the layers affected:

- route params and platform host
- position/supported-action/build payload
- approval/permit and business confirmation sequence
- broadcast/order/settle result
- main event owner and bg log
- persisted record and fresh restart/account switch

Element existence or a successful build response alone is not proof.
