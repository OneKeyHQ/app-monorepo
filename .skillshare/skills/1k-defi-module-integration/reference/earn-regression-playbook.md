# Earn Regression Playbook

Use this when reviewing or extending Earn protocol integrations. It captures
recent regression patterns from Jira/Rovo requirements, GitHub PRs, backend
contract checks, and local/runtime review work.

## Review Inputs

Before judging a new Earn protocol PR, collect these sources when available:

- Jira/Rovo: PRD, QA issues, protocol operation matrix, and backend API notes.
- GitHub: current PR diff, existing review threads, related recent PRs, CI
  status, and whether the branch targets `x` or a `release/*` branch.
- Backend repos: DTOs, build-transaction services, order creation/update logic,
  and provider-specific adapters.
- Runtime: desktop/mobile DevTools network evidence for actual request payloads,
  analytics events, and transaction-confirmation responses.
- Slack or desktop context: use only when directly inspected. If unavailable,
  do not present it as verified evidence.

## Recent High-Risk Patterns

### 1. Contract-First Operation Mapping

Do not start from UI shape alone. For every provider, map the exact operation
contract first:

- Stake/deposit: token input, `vault`, approval spender, tx builder, and whether
  setup transactions are business actions or prerequisites.
- Withdraw: instant vs queued vs cancel, approval token/spender, amount
  semantics, `withdrawAll`, disabled options, and preview tips.
- Claim: reward claim vs queued-withdrawal claim vs airdrop claim. Confirm which
  fields are provider-specific.

Native Earn showed why this matters: `stakeType`, `withdrawType`,
`withdrawApprove`, disabled/typed confirm boxes, `withdrawPath.data.tip`, and
cancel-withdraw symbol fallback are real contract fields, not generic staking UI
details.

### 2. Provider Identity, Routes, and Share Links

Provider identity must round-trip through every frontend and backend boundary.
Do not assume the display name, enum value, route param, API provider field, and
share URL segment are interchangeable.

- Add new providers to the shared earn provider enum and provider-name mapping
  before testing share links or deep links.
- Verify lower-case URL/query values such as `native` are normalized to the
  provider enum used by detail, manage, portfolio, and background-service calls.
- Share/deep-link QA must open the copied URL from a fresh tab/app state, not
  only navigate inside the current screen.
- Protocol list, detail, manage-position, portfolio action, and history entry
  navigation must preserve `provider`, `networkId`, `symbol`, `vault`, and action
  type when the provider needs them.

Native Earn showed the failure mode clearly: the feature can work in an already
mounted detail page while a shared URL fails with "unknown provider" if
`native` is not mapped to the `Native` provider enum.

### 3. Wrapped-Native, Order, Pending, and Analytics Semantics

Every transaction path must answer: which step creates the user-visible Earn
order, which txid updates it, and which pending indicator should refresh data.

- Only record real business orders. Setup transactions such as ETH wrap, permit,
  approve, LUT setup, or cooldown preparation should not silently become Earn
  orders unless product explicitly wants them visible.
- Setup transactions must not inherit final business-action metadata used by
  transaction-confirmation parsing. In batch flows, an approve/permit/wrap
  unsigned transaction should carry only its own approve/setup metadata; the
  final stake/withdraw/claim transaction carries `stakingInfo` and order
  tracking metadata.
- If backend creates an order during tx build, frontend must either update that
  order with the final txid or the backend must avoid creating an order for
  prerequisite steps.
- `stakingInfo.tags` must identify the correct protocol/symbol/vault scope so
  pending indicators and targeted refreshes are not over-broad.
- Analytics payloads must stay sanitized. Do not send `txId`, `orderId`,
  `networkId`, current/new tx ids, or raw order entities to generic tracking
  events unless explicitly approved. Prefer protocol/label/tag/status fields.
- Wrapped-native flows need an explicit step map: native-token wrap, wrapped
  token approval, protocol deposit/withdraw, and order sync are separate
  concerns even when the UI presents one action.
- Warning or loss dialogs must close before opening transaction confirmation;
  nested modal state should not leave confirm buttons disabled or hidden behind
  stale overlays.

### 4. Provider-Specific Parameter Isolation

Avoid making one provider's workaround part of the shared contract:

- `claimTokenAddress` is Morpho-specific; Pendle claim flows need their own
  symbol/vault mapping and should not inherit Morpho reward-token parameters.
- `vault` propagation should use a helper such as `shouldSendEarnProtocolVault`
  when a provider needs vault in API calls, but do not widen
  `isVaultBasedProvider` semantics unless all consumers expect that behavior.
- Provider-specific receive tokens, slippage, cooldown, receipt-token rates,
  claim types, and cancel actions must be optional and no-op for other
  providers.

### 5. Withdrawal, Claim, and History Semantics

Withdraw-related operations are not one action with different labels. Model the
server-supported states and on-chain preconditions explicitly.

- Instant withdraw, queued withdraw, cancel queued withdraw, and claim queued
  withdrawal must each have a distinct action/claim/withdraw type when the
  backend contract distinguishes them.
- Do not show or enable cancel/claim actions unless the position has the pending
  request required by the contract. A user-visible `No pending request` revert is
  a precondition bug, not an error-copy problem.
- History filters and row titles should be derived from action semantics instead
  of generic deposit/withdraw translations. Check "apply immediate redeem",
  "apply queued redeem", "subscribe", "claim", and cancel paths separately.
- Receipt tokens and signed deltas, such as negative underlying and positive
  receipt-token rows, are display/accounting facts. They must not be reused as
  wallet-balance validation inputs without a deliberate conversion rule.

### 6. Shared Component Blast Radius

Changes to these files are high-review-scope even when the feature is one
provider:

- `UniversalStake`
- `UniversalWithdraw`
- `useUniversalHooks`
- `ManagePosition` and its `StakeSection` / `WithdrawSection`
- `ServiceStaking`
- `shared/types/staking.ts`
- `shared/src/routes/staking.ts`
- `shared/src/utils/earnUtils.ts`

For these changes, explicitly state why Pendle, Ethena, Stakefish, Morpho, Lido,
and other existing providers remain unaffected.

### 7. Multi-Asset and Selector State

Recent regressions came from using the wrong cached data source for a selector
or protocol list:

- Token selectors must fetch their own `flag=token-selector` data when normal
  wallet tokens are needed; do not rely on Home's DeFi-filtered atom after
  refresh/restart.
- DeFi token filtering must be gated by network support and backend-indexer
  availability. Non-indexer EVM networks should not inherit filters just because
  the chain is EVM-compatible.
- Quick Deposit and Featured assets need a clear source of truth for pinned,
  badge, APY ordering, and protocol switcher data. Mock fallbacks must be
  removed before merge.
- Funding CTAs such as "Trade", "Buy", "Swap", or "Wrap" are cross-surface
  handoffs. Verify the target surface supports the exact token form being
  passed, especially native ETH vs WETH, bridge vs swap mode, and Limit order
  unsupported-token warnings.

### 8. DeFi Portfolio Operation Mapping

Portfolio operation buttons depend on server-supported protocol/action mapping,
not on local guesses from a third-party data provider:

- Use wallet-service protocol IDs and supported actions as the source of truth.
- Map category -> action per protocol (`withdraw`, `claim`, `claimWithdrawal`,
  `removeLiquidity`, etc.).
- Keep Zerion/Debank IDs and internal protocol IDs separated.
- Hide or disable actions when the support matrix does not cover the exact
  network, position category, asset category, and action.

### 9. Quote, Refresh, and Stale Data

For quote-driven providers such as Pendle:

- Show skeleton/loading while quote data is being fetched instead of rendering
  stale values.
- Guard async quote/confirmation updates against stale responses.
- Reset quote state on token, vault, provider, account, network, amount, and
  path changes.
- Refresh data after tx success from the same scope that created the pending
  transaction.

## Regression Matrix for Earn PRs

Run or explicitly defer these paths for any PR touching shared Earn operation
components:

| Provider/path | Minimum checks |
| --- | --- |
| Native | Shared URL/deep link, ETH wrap + stake, WETH/USDT normal stake, approve-required confirmation where the first row renders as approval and the final row renders as stake, wrapped-order sync, instant withdraw, queued withdraw approval, cancel withdraw, queued claim, history filters, insufficient-balance state, loss-dialog confirmation |
| Pendle | Asset selection, quote loading/expiry, slippage, withdraw path, high-price-impact warning, claim params |
| Ethena | Cooldown withdraw and claim-withdrawal continuation |
| Stakefish | ETH sign-message stake/withdraw paths and validator identity |
| Morpho | Vault-specific stake/withdraw/claim and Morpho-only reward-token params |
| Lido | Permit/withdraw/claimWithdrawal paths when relevant |
| Quick Deposit | Featured card -> modal, protocol switcher, cross-chain data, mock-free data |
| DeFi Portfolio actions | Supported-protocol matrix, action visibility, build-transaction params |

## Review Output Rules

When reviewing a PR:

- Separate security/asset-safety issues from order/analytics/data-consistency
  issues.
- Explicitly say whether other protocols are affected and name the shared files
  that create the blast radius.
- If a finding requires backend cooperation, state why a frontend-only fix would
  produce the wrong business semantics.
- Keep release-gate failures, missing test evidence, and stale PR metadata
  separate from code findings.
