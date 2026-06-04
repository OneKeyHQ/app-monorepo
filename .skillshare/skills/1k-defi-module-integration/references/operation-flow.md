# Operation Flow

## Operation Contract

Every DeFi operation needs this contract before implementation:

| Area | Questions |
| --- | --- |
| Operation type | stake, withdraw, claim, redeem, supply, borrow, repay, collateral toggle, wrap, swap-assisted repay, or custom |
| Provider identity | provider, market, reserve, vault, symbol, category, network, and account |
| Amount model | input token, output token, native/wrapped token, decimals, max amount, dust, and fiat display |
| Setup action | approval, permit, wrap, cooldown, quote, KYC, risk confirmation, or none |
| Business action | transaction, order, provider action, contract call, or handoff |
| Risk state | liquidation, slashing, cooldown, maturity, lock period, region block, unsupported account, or market unavailable |
| Pending identity | staking tag, label, txid, order id, provider id, or composite key |
| Refresh scope | portfolio, protocol detail, borrow market, reserve detail, history row, or cross-surface target |

## Transaction Sequencing

Do not merge setup and business actions into one opaque function. Name the sequence:

1. Load protocol/account/token data.
2. Validate amount and risk state.
3. Run setup if required.
4. Build/sign/send the business action.
5. Create or update pending state.
6. Refresh the smallest affected scope.
7. Update history and final status.

If a step is provider-managed, still represent it in App state as loading, unavailable, pending, failed, success, or unknown.

## ABI-Backed Operations

For ABI-backed protocols, verify:

- contract address source and network binding
- function name and typed params
- token amount unit conversion
- allowance/permit/wrap requirement
- account derive type and address format
- simulation or validation result when available
- transaction label and pending tag
- post-send refresh target

Avoid encoding raw ABI details in UI components. Put ABI-specific data into an adapter or service boundary that returns App operation state.

## Native Or Provider-Backed Operations

For native/provider-backed protocols, verify:

- native token semantics, including empty address vs explicit native marker
- provider capability and unsupported states
- chain-specific account and derive requirements
- setup/business sequence
- provider status mapping
- pending/history identity
- detail refresh and portfolio refresh

Native/provider-backed does not mean untyped. The App still needs typed operation state.

## Swap-Assisted Operations

Swap-assisted operations must define the ownership boundary:

- DeFi owns source context, risk, and prefill.
- Swap owns quote, review, build, send, and Swap history after quote starts.
- DeFi owns return refresh only if the user returns to a DeFi position surface.

Examples include funding, wrap, Trade/Buy entry points, and repay-with-collateral.

## Disabled, Loading, And Error States

Each operation must handle:

- account missing or unsupported
- network unsupported
- provider unavailable
- token unavailable
- balance insufficient
- amount below/above limits
- setup action required
- quote expired
- transaction pending
- final status unknown

These states should be visible at the operation boundary, not discovered only after signing.
