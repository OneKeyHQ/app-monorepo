# Checklists

## Durable Integration Checklist

Run this before shipping or approving Earn/Borrow/Staking work:

1. Provider identity survives route round trip: provider, network, symbol, vault/market/reserve, account, indexed account.
2. Operation contract is named: stake, withdraw, claim, redeem, supply, borrow, repay, collateral, wrap, swap-assisted, or custom.
3. Setup and business transactions are sequenced explicitly.
4. Action capability is scoped per position/reserve/action. A disabled or unsupported row does not prove sibling rows should be blocked or hidden.
5. Amount model is correct: decimals, native/wrapped token, max amount, dust, fiat, available balance, manual input, percentage buttons, and zero/invalid disabled state all use the same validator.
6. Request amount serialization matches the backend contract; parsed decimal values are not sent in exponent notation.
7. Approval, allowance, permit, wrap, or setup readiness is keyed by account, network, spender, token/reserve, provider, and action; changing the target clears stale setup state.
8. Data owner is named: home, list, detail, operation, portfolio, borrow DataGate, pending, or history.
9. Page, module, operation, request, and terminal loading states are named separately.
10. Error display owner is named: server auto-toast, caller toast, inline error, or disabled state, not multiple at once.
11. Request staleness is guarded by account, route, provider, token, and visible content.
12. Pending tags, labels, filters, and refresh scope are defined.
13. History rows show the right operation, token, provider, account, and final status.
14. Cross-surface handoffs preserve source context and target ownership.
15. UI visibility in `main` and build/sign execution guards in `bg` are reviewed separately when account capability changes.
16. Platform host and layout are validated on the affected platform.
17. Native crash or freeze claims include the exact confirm/send path plus Android/iOS log, Sentry event, or JS/native crash boundary.
18. Shared utility changes include existing-protocol regression reasoning.
19. User-facing text follows the repository i18n workflow.

## ABI Readiness Drill

Use this drill for L2 or protocol integrations where the App builds contract calls:

- Which route opens the protocol, and what params reload it from a fresh state?
- Which network/account types are supported?
- Which contract address is used, and how is it bound to network/provider?
- Which read calls hydrate home, list, detail, and operation state?
- Which write call is the business action, and what typed params does it need?
- Is approval, permit, wrap, cooldown, or setup required before the business action?
- Which amount units are raw vs parsed vs display?
- Which pending tag and history label represent the action?
- Which refresh scope proves completion?
- What unsupported or final-unknown states are visible to the user?

## Native/Provider Readiness Drill

Use this drill for native staking, chain-specific, or provider-backed operations:

- Is the operation represented by existing Earn/Borrow/Staking semantics?
- How are native token and empty-address semantics handled?
- Which account derive types or address formats are supported?
- What does the provider own, and what does the App still own?
- Which setup and business steps are visible in App state?
- Which provider statuses map to App pending, success, failed, canceled, expired, or unknown?
- Which route and platform surfaces need validation?

## Borrow Checklist

- Market and reserve identity are not collapsed into symbol only.
- Health factor, collateral, supplied, debt, and liquidation risk refresh together.
- Supply, withdraw, borrow, and repay preserve distinct disabled/error states.
- Repay and withdraw setup state is keyed to the selected reserve, not reused
  from a previous token or action.
- Repay-with-collateral or swap-assisted repayment delegates Swap execution cleanly.
- Borrow native detail layout is checked separately from desktop/web.

## Earn/Staking Checklist

- Provider, vault, network, symbol, category, and account survive list/detail/operation round trip.
- Recommended cards are classified as global catalog data or account-scoped
  balance data before fetch and refresh behavior is changed.
- If balance or wallet UI is removed from recommendations, remove the matching
  account-scoped fetch, cache key, app event, pending/swap refresh coupling,
  and balance skeletons instead of preserving hidden account refresh work.
- Hidden Earn, Borrow mode, and inactive Earn tabs do not fetch recommended or
  available-assets data unless the visible host says they are active.
- Stake, withdraw, claim, redeem, and maturity-driven variants use typed operation state.
- Approval, permit, wrap, cooldown, quote, and KYC states are visible before sign.
- Pending indicator and history filters use the same tags.
- Detail charts and protocol intro content do not own operation state.
- After a successful operation, the visible owner refetches or reconciles its
  own scoped data; emitting a global account event is not proof the current
  route refreshed.

## Review Checklist

- Lead with concrete behavior risk and state owner.
- Separate validation gaps from code correctness.
- Prefer local adapters over branching shared components for one protocol.
- When changing shared Staking/Borrow contracts, list affected existing protocols and the regression path.
- For account-capability changes, separate main-runtime UI affordance from
  background build/sign safety. The two JS heaps do not share App state, and a
  visible action button is not proof that execution is allowed.
- If ABI/native drills cannot be completed, the integration is not ready.
