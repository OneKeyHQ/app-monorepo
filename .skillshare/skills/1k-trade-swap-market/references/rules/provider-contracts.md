# Provider Contracts

Provider behavior is not interchangeable. Confirm field semantics before applying generic Swap logic.

## Contract Checklist

| Field | Questions |
| --- | --- |
| Amount limits | Are `min`/`max` in from-token amount, to-token amount, USD/fiat value, or provider units? |
| Fees | Is it protocol fee, provider fee, network fee, service fee, discount, or cost saving? |
| Rate | Is it fixed, floating, indicative, execution, or display-only? |
| Address | Is it user input, refund, receiving, deposit, or selected BTC input address? |
| Status | Which raw statuses map to pending, completed, failed, refunding, refunded, canceling, or canceled? |
| Chain support | Is support keyed by network id, chain id, token address, symbol, or provider token id? |

## Known Patterns

- **SWFT BTC**: preserve selected BTC input address through user address, refund address, transfer source, selected UTXOs, and `ForceSelected`; signed rebuild must keep the selected UTXO plan.
- **Houdini**: receiving address, privacy/standard behavior, estimated arrival time, and status mapping are provider contracts, not generic Swap defaults.
- **RocketX**: do not assume `limit.max` or `limit.min` uses from-token amount; verify fiat/provider units first. For Private Send/incognito, treat provider, ETA, received-token identity, value-drop warning, order creation, and final status as one contract path.
- **LiFi**: cross-chain pending state and fee fields are provider-specific; missing fee and zero fee differ.
- **Cow Limit**: preserve actionable errors like `SellAmountDoesNotCoverFee` and `NoLiquidity` instead of collapsing them into ordinary no-route behavior.

## Native / Wrapped Token Contract Rule

Native tokens and wrapped ERC-20 tokens are separate execution contracts even
when the UI copy says "ETH" in both places.

- Treat native ETH, WETH, and receipt/wrapped Earn tokens as separate token
  identities with their own address, balance, allowance, and support matrix.
- Do not auto-convert native -> wrapped or wrapped -> native during a handoff
  unless the target flow has an explicit wrap/unwrap step and confirmation path.
- Limit order support must be checked against the actual sell token identity. If
  native ETH is unsupported, do not let a DeFi/Earn funding CTA land in a Limit
  path that says it cannot sell ETH unless the next action is clearly Wrap or
  switch to a supported Swap mode.
- Balance and insufficient-balance states must be computed for the token form
  that the target surface will execute, not for the display token on the source
  surface.

## Analytics Contract Rule

For Private Send or provider-specific analytics, event fields must come from the same quote/order/status snapshot that owns execution:

- Mode switch: previous mode, next mode, network, token.
- Quote: success/failed status, provider, source/received token, amount, estimate, ETA, and failure message.
- Value-drop warning: quote-scoped dedupe key and drop percent.
- Create order: wallet type, provider, source/received token, amount, fiat value, estimate.
- Final status: provider order id, raw/final status, failure reason, received amount, and duration.

Do not synthesize missing provider fields from display fallbacks without confirming the backend event contract.

## Backend Coordination Rule

When unclear, stop at a contract question:

1. Quote the exact field, endpoint, and observed payload.
2. State the frontend assumption.
3. Ask backend/product or search Jira/Slack for the decision.
4. Only then implement display, validation, analytics, or history behavior.
