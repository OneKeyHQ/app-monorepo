# Checklists

## Durable Integration Checklist

Run this before shipping or approving Earn/Borrow/Staking work:

0. Source packet is current when the task came from Jira, Slack, review, or a
   todo ledger: issue comments, Slack context, attachments, client branch, and
   server supported-protocols/build-transaction/portfolio DTO branch when
   relevant.
0a. Closest valid repo pattern is named, including why its provider/network/
    account/token/route/operation semantics do or do not apply.
1. Provider identity survives route round trip: provider, network, symbol, vault/market/reserve, account, indexed account.
2. Operation contract is named: stake, withdraw, claim, redeem, supply, borrow, repay, collateral, wrap, swap-assisted, or custom.
3. Setup and business transactions are sequenced explicitly.
4. Amount model is correct: decimals, native/wrapped token, max amount, dust, fiat, and available balance.
5. Data owner is named: home, list, detail, operation, portfolio, borrow DataGate, pending, or history.
6. Request staleness is guarded by account, route, provider, token, and visible content.
7. Pending tags, labels, filters, and refresh scope are defined.
8. History rows show the right operation, token, provider, account, and final status.
9. Cross-surface handoffs preserve source context and target ownership.
10. Platform host and layout are validated on the affected platform.
11. Native crash or freeze claims include the exact confirm/send path plus Android/iOS log, Sentry event, or JS/native crash boundary.
12. Shared utility changes include existing-protocol regression reasoning.
13. User-facing text follows the repository i18n workflow.
14. Large hooks are split only by stable responsibility: route sync, data
    loading, operation state machine, listener refresh, pending/history bridge,
    or view-model composition.

## Half-Year Recurrence Stops

Use this stop list when a new Earn/DeFi/Borrow/Staking requirement mentions
action buttons, claim/withdraw/repay, missing refresh, duplicate toast,
mobile input, native Earn, AssetDetails, or cold-start entry:

- Action visibility is contract-first. Check portfolio position payload,
  supported-protocols, and build-transaction metadata before treating a missing
  button as layout, i18n, or local visibility state.
- Grouped portfolio rows must preserve source-position metadata such as
  group id, pool address, token id, currency pair, queue id, proxy detail, and
  category. If grouping drops metadata, fail closed instead of rendering a
  button that cannot build a transaction.
- Build responses can carry `orderId`, `tx`, `approvalTx`, and `permit`.
  Normalize transport variants at the service boundary, keep UI typed, and
  make approval/permit support explicit before entering signature confirm.
- DeFi order tracking must guard duplicate submit: after broadcast, record the
  transaction hash against the service `orderId`; after on-chain completion,
  update final status and refresh the affected portfolio/detail scope.
- Do not suppress operation errors only because a lower-level error has
  `autoToast=false`. If the operation is user-actionable, preserve diagnostics
  fields and show one visible operation-level error path.
- Mobile DeFi amount input and dialogs need their own validation for decimal
  precision, cursor position, keyboard, modal height, bottom-sheet drag, safe
  area, and scrollability. Desktop/web behavior is not proof for native.
- Successful submit/confirm triggers visible portfolio/detail refresh plus
  delayed refresh for indexer lag. User cancel and failed tx do not get the
  same refresh semantics unless product requires recovery refresh.
- Native Earn is a Discovery-hosted flow. Validate fresh native open, repeated
  entry, pop-to-home, and tab switching separately from desktop/web Earn tab.
- AssetDetails and DeFi Portfolio action routes must carry account identity
  through route params or payload. Home-only account context is not available
  unless the target stack mounts the matching provider mirror.
- Swap-assisted funding stops at prefill and return refresh. Once Swap quote
  starts, quote/review/build/send/history validation belongs to
  `1k-trade-swap-market`.

## Entry And Platform Drill

Run this when a requirement mentions Earn entry, Home Earn, native Earn,
AssetDetails, DeFi Portfolio, or Swap-assisted funding:

- Name the entry surface and the first DeFi owner after entry.
- For native, prove whether the path is Discovery EarnHome sub-tab switching or
  a pushed Earn route under Discovery; do not validate it only on desktop/web.
- For DeFi Portfolio and AssetDetails routes, verify account and
  indexed-account identity survive without Home-only provider context.
- For Swap-assisted funding, validate DeFi source params and return refresh,
  then hand quote/review/build/send/history validation to `1k-trade-swap-market`.

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

## Review Checklist

- Lead with concrete behavior risk and state owner.
- Separate validation gaps from code correctness.
- Prefer local adapters over branching shared components for one protocol.
- When changing shared Staking/Borrow contracts, list affected existing protocols and the regression path.
- If ABI/native drills cannot be completed, the integration is not ready.

## Recent Failure-Derived Gates

Apply these as durable regression gates; verify current client/server/payload
truth before assuming the original incident details still apply.

- Action visibility is a three-source decision: portfolio/source metadata,
  supported-protocol action contract, and build requirements. Do not infer it
  from layout or one category field.
- Outer position category and inner asset category have different meanings.
  Preserve both through grouping and action resolution.
- Native token may require an empty address while amount and `bps` have
  different unit rules. Derive payloads from the current handler/DTO/example;
  never trust an agent-generated field assumption without source proof.
- ERC20 repay/withdraw can require approval. Complete approval and close or
  hand off its confirm UI before business confirmation; every terminal callback
  must release duplicate-submit state.
- A build response can contain `tx`, `approvalTx`, `permit`, and `orderId`.
  Broadcast success attaches tx hash to the order; settle updates final status;
  only successful position-changing outcomes trigger success refresh.
- Native iOS action pages and extension/desktop dialogs are different hosts.
  Validate keyboard dismissal, replaceable 100% input, scroll/layout, confirm
  layering, cancel, failure, and success on their owning hosts.
- Manual portfolio refresh needs deliberate forced freshness without becoming
  an abuse bypass. Keep frontend cadence/quota, backend abuse protection, and
  bg persistence as separate owners.
- All Networks refresh is account/network scoped. Direct per-account writes,
  owner-key reconciliation, scheduled-refresh abort independence, and A -> B
  stale-result rejection are mandatory.
- Issue/PR titles are not authoritative scope. Inspect late Jira/Slack
  corrections, attachments, branch-only commits, and actual changed files;
  adjacent DeFi, Borrow, Stock, or chart changes can be hidden in one squash.
