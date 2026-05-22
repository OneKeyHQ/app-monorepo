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
- **RocketX**: do not assume `limit.max` or `limit.min` uses from-token amount; verify fiat/provider units first.
- **LiFi**: cross-chain pending state and fee fields are provider-specific; missing fee and zero fee differ.
- **Cow Limit**: preserve actionable errors like `SellAmountDoesNotCoverFee` and `NoLiquidity` instead of collapsing them into ordinary no-route behavior.

## Backend Coordination Rule

When unclear, stop at a contract question:

1. Quote the exact field, endpoint, and observed payload.
2. State the frontend assumption.
3. Ask backend/product or search Jira/Slack for the decision.
4. Only then implement display, validation, analytics, or history behavior.

