# App Architecture

## Canonical Flow

Map every DeFi change through:

`host/route -> home -> list/detail -> operation modal -> transaction sequence -> pending refresh -> history -> cross-surface handoff`

Each step has a different state owner. Most regressions happen when a later step reads assumptions from an earlier step instead of preserving its own contract.

## Surface Map

- Earn home owns overview, portfolio, recommended assets, protocol tabs, and Borrow embedding.
- Earn list/detail owns provider, network, symbol, vault, category, chart, and share/deep-link round trip.
- Staking operation pages own stake, withdraw, claim, quote, approval, permit, wrap, cooldown, and sign/send flows.
- Borrow home/detail owns market, reserve, account, supplied/debt state, health factor, and collateral actions.
- Borrow operation pages own supply, withdraw, borrow, repay, and repay-with-collateral flows.
- Pending/history owns staking tags, labels, filters, refresh scope, and completion behavior.
- Discovery hosts native Earn. Desktop/web use the Earn tab route.

## Reuse Earn/Borrow Or Create New Surface

Choose the smallest surface that preserves operation semantics:

- Use Earn when the protocol is yield/staking/vault-like and operations are stake, withdraw, claim, redeem, or maturity-driven variants.
- Use Borrow when the protocol is lending/borrowing with collateral, debt, reserves, health factor, or liquidation risk.
- Use Staking shared operation stack when the flow can be represented by existing operation components plus typed adapters.
- Use a new DeFi surface only when the operation model, risk model, and navigation cannot be represented by Earn/Borrow without making those surfaces misleading.
- Use Trade/Swap handoff when the action is funding, route conversion, or swap-assisted repayment rather than a DeFi position operation.
- Use Discovery/browser handoff when the App is only launching a protocol surface and not owning execution.

## Protocol Extension Styles

### ABI-Backed

The App owns typed contract-call parameters and must define:

- chain/network and account requirements
- contract address source and validation
- read functions and cache invalidation
- write function params and token amount units
- approval, permit, wrap, or setup transaction needs
- pending tags and history label
- unsupported states by network, token, or account type

### Native Or Provider-Backed

The App delegates protocol-specific execution to a provider or chain-specific service, but still owns:

- route params and provider identity
- native token and address semantics
- setup/business transaction sequence
- disabled/loading/error states
- pending/history identity
- refresh scope and completion polling

### Swap-Assisted

Swap-assisted DeFi flows must define where DeFi ownership ends and Swap ownership begins. Once Swap quote starts, Swap owns execution state.

## Cross-Surface Handoff

Every handoff must preserve:

- network id
- provider
- symbol/token/vault/reserve/market
- account and indexed account
- operation type
- return route or success refresh target

Handoff validation requires a fresh app/tab path, not only in-page navigation.
