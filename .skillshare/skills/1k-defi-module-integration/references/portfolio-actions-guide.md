# DeFi Portfolio Actions Guide

Use this when adding or debugging one-click actions on existing DeFi portfolio
positions, such as withdraw, claim, claimWithdrawal, and removeLiquidity.

## Source Of Truth Boundaries

Treat the three backend surfaces as separate contracts:

| Surface | Endpoint | Owns |
| --- | --- | --- |
| Portfolio positions | `/wallet/v1/portfolio/positions` | Current positions, grouped source data, asset categories, and per-position execution metadata |
| Supported actions | `/earn/v1/defi/supported-protocols` | Protocol/network/category/action support declarations |
| Transaction builder | `/earn/v1/defi/build-transaction` | Final action validation and transaction payloads |

Do not infer action availability from only one surface. An action can be
supported by the Earn service but still hidden for a specific row if the Wallet
position payload does not include the metadata needed to build a transaction.

## Action Visibility

Resolve actions contract-first:

- Match `protocolId`, `networkId`, `positionCategory`, and the target asset or
  reward category.
- Keep frontend category aliases small and explicit; update them only when a
  real upstream payload uses a new stable value.
- Preserve `sourcePositions` through grouped UI rows. Merging rows must not drop
  per-position contracts, extra params, queue ids, or token ids.
- Fail closed when required metadata is absent. Do not render a button that will
  predictably fail in `build-transaction`.

Required metadata examples:

- Aave/Morpho/Polygon/Spark withdraw or claim flows may require `poolAddress`
  when the service contract says so.
- Polygon staking `claimWithdrawal` needs the redemption queue nonce(s), usually
  returned as `extraParams.unbondNonces`; cooldown display labels can be used
  only when their format is documented and stable.
- Uniswap V3/V4 `removeLiquidity` needs `tokenId` (`positionId`/`nftId` aliases
  are acceptable only if the backend payload explicitly uses them). Uniswap V4
  also needs `currency0` and `currency1`.

If a product or QA question asks why an action is not visible, first inspect the
current position payload and the supported-protocols row. Most cases are backend
payload/category-contract issues, not button layout issues.

## Build Transaction Responses

`/earn/v1/defi/build-transaction` may return transaction-like fields as JSON
strings for transport compatibility:

- `tx`
- `approvalTx`
- `permit`

Normalize these at the background/service boundary before passing them to UI or
signature confirmation. UI components should continue to handle typed objects.
Keep compatibility with object-shaped responses when possible during backend
rollout.

Approval flows are a separate UX contract. If `approvalTx` is returned and the
current action surface does not support approval confirmation, fail clearly
instead of silently submitting only the business transaction.

## Post-Action Refresh

Refresh semantics should match transaction state:

- On successful action submission/confirmation, trigger a visible portfolio
  refresh and emit the normal account-data update event.
- Schedule delayed force refreshes after locally confirmed transactions to cover
  backend/indexer lag.
- Do not force-refresh positions on user cancel or transaction failure unless
  product explicitly needs a recovery refresh; failed txs do not move positions.

For background delayed refreshes, avoid sharing UI abort controllers and avoid
cache writes that can cross accounts or networks.

## Validation Checklist

Before marking a portfolio action ready:

- Confirm the latest service branch contract for supported actions and
  build-transaction DTOs.
- Capture or inspect a real `/wallet/v1/portfolio/positions` payload for the
  affected protocol/account.
- Verify the action resolver sees the original source position metadata after
  any UI grouping.
- Exercise both the visible action path and the missing-metadata path.
- For build tx response shape changes, validate old object responses and new
  JSON-string responses.
- State clearly when Slack, Jira attachments, or runtime service data were not
  directly readable.
