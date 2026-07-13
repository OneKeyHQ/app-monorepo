# Checklists

## Durable Bug-Prevention Checklist

Run this before shipping or approving Trade/Swap/Market work:

0. Framework -> state machine -> hooks has been traced for cross-surface,
   modal, Home Token, Send, Market, Earn, Buy, Stock, Bridge, or Limit work.
0a. Source packet is current when the task came from Jira, Slack, review, or a
    todo ledger: issue comments, Slack context, attachments, client branch, and
    server DTO/status branch when relevant.
0b. Closest valid repo pattern is named, including why its account/network/token
    provider, route, or execution semantics do or do not apply.
1. State owner is named: server config, quote payload, build payload, atom, simpleDb, local component state, or provider adapter.
2. Async identity is guarded: request id, event id, provider key, token key, account, amount mode, and stale response handling.
3. Account/network/token/route identity is separated: source, target, All Networks, derive type, native/wrapped token, receiver, entry source, and behavior-changing route params such as `isNative`, `showFavoriteButton`, and `disableTrade`.
4. Provider contract fields are interpreted: fees, rate, ETA, min/max, limits, quote context, order id, txid, and status.
5. Review data is frozen: confirm does not keep reading mutable page state after the user enters review.
6. Approval/setup is explicit: allowance, permit, wrap, setup tx, and business tx are not merged invisibly.
7. Pending history is created after send success with the correct identity before status polling is trusted.
8. Channel state is declared: history display, listener source, local writeback, replay/enrichment, and repair rules.
9. Market/K-line data is isolated from quote/build state.
10. Platform ownership is checked: desktop, web, extension, native mobile, tablet, modal, and bottom-sheet differences.
11. Adjacent Wallet/Receive/Home Token ownership is not assumed to match Swap/Market selector ownership.
12. Import hierarchy is preserved.
13. Large hooks are split only by stable responsibility: data loading,
    selection/route sync, quote/review state machine, listener/history bridge,
    or view-model composition.

## Half-Year Recurrence Stops

Use this short stop list when a new requirement mentions cold start, loading,
first entry, Stock, unsupported networks, disconnected wallet, or history:

- Unsupported single-network entries must resolve to an explicit empty/Select
  Token state or disabled action. They must not wait forever for token lists,
  market detail, DeFi maps, or provider support checks.
- No-wallet, disconnected-wallet, and unsupported-account alerts require
  account info, account-selector storage, active-account init, and wallet-list
  readiness. Do not show an unsupported-account warning while the app is still
  deciding whether a wallet exists.
- Disconnected-wallet history behavior is a display contract: hide local
  history/recent pairs when required, but do not clear local data unless the
  requirement explicitly says to delete it.
- Separate same-session revisit, app restart, and true cold start. A fix that
  only preserves state while the tab stays mounted is not proof that
  cold-start cache, pre-read Home snapshot, or first-frame display works.
- Separate first-frame display seed from trade readiness. Cached/default
  tokens can make the first frame meaningful, but quote/build/send remains
  gated by active token detail, market/provider state, account readiness, and
  stale-response guards.
- Route and handoff params are one-shot inputs. After they are consumed,
  manual selection and channel state must win over later Home/account sync.
- Stock and future order channels must keep `swapType`, pay token, stock token,
  market status, build protocol, pending count, history filters, and selector
  cache distinct from ordinary Swap even when they share Swap UI.
- Moving between Stock, Swap, Bridge, and Limit must preserve the previous
  channel-owned selection and must not leave the next token selector or quote
  panel in a permanent loading state.
- Skeleton/layout fixes are cross-surface until proven local: check Swap,
  Stock, Swap Pro, mobile modal/bottom sheet, and extension/sidebar variants
  when the shared skeleton, dialog height, or token-selector layout changes.
- Gas sponsor and provider capability fields are quote/build contracts. Trace
  quote response, build response, estimate-fee/send params, and global setting
  before treating a fee error as a UI-only issue.

## Entry Ownership Drill

Use this for bugs that mention "Home Swap", "首页兑换", direct Swap page, Earn
funding, Send handoff, Market speed-swap, or mobile-only behavior:

- Name the entry owner and the first Swap owner after `SwapMainLand` mounts.
- Compare the handoff params against the settled Swap state: `importNetworkId`,
  `importFromToken`, `importToToken`, `importDeriveType`, `swapTabSwitchType`,
  `swapSource`, and any amount/preset params.
- Separate desktop/web route or modal behavior from native mobile dialog,
  bottom-sheet, K-line variant, keyboard, safe-area, and Limit-focus behavior.
- If the bug is visible only on first entry, run the cold-start frame checklist
  rather than validating only the final settled screen.

## New Channel Readiness Checklist

Use this for PrivateSend-like, stock/order, or unusual provider channels:

1. Entry surface is defined: Swap page, Market detail, Send handoff, Earn handoff, or dedicated modal.
2. Capability is defined: token swap, order, privacy order, stock order, bridge, funding, or data-only.
3. Asset model is defined: token, native, wrapped, stock-like, provider synthetic, or route-only.
4. Quote identity is stable across provider, amount, token, account, receiver, session, and request id.
5. Review explains what the user signs or submits, including hidden receiver or non-token settlement semantics.
6. Build response variant is typed and routed through one adapter.
7. Post-send identity chooses txid, order id, route id, or composite key deliberately.
8. History row, detail page, and status polling use the same identity.
9. List inclusion/exclusion is explicit for visible Swap & Bridge, internal Bridge/history semantics, Market, and channel-specific history surfaces.
10. Cold-start ownership is explicit: whether the channel uses shared selected-token atoms, how `swapType` is stored in the persisted context, which visible tab is restored, and whether ordinary Swap default-token sync must be skipped.
11. Replay and repair sources are defined for app restart, account-history entry, notification entry, and backend field backfill.
12. Error states include provider unavailable, unsupported route, expired quote, market closed, partial fill, and unknown finality when applicable.
13. Validation covers both happy path and one provider/channel failure.

## PrivateSend-Like Drill

Complete this drill before saying the skill can guide a privacy/order channel:

- Which surface enters the channel, and does it reuse Swap selection or a Send handoff?
- Which receiver/address fields are visible, hidden, delayed, or provider-owned?
- Which quote fields are frozen in review, and which progress fields appear only after send?
- Which id drives pending history: txid, order id, route id, or composite key?
- Which status steps are shown in detail, and which are terminal?
- How does the detail page fetch or preserve token price when normal swap data is unavailable?
- What runtime payload proves the order has been created?
- Which source repairs an old local row missing provider/order fields?

## Stock/Order Channel Drill

Complete this drill before wiring a stock-like protocol:

- Is the asset model token-like, stock-like, or provider synthetic?
- What account signs, and what account or venue settles?
- What happens when the market is closed, partially filled, canceled, or expired?
- Which owner gates market-open state: stock channel state from token/detail data, quote error metadata, or a server order-status response?
- Who owns cold-start token restoration: shared Swap cache, Stock provider, or a route preset?
- Which fields are commission, spread, settlement fee, or network gas?
- If the quote returns an order/sign payload instead of a normal tx, which path builds the order and prevents fallthrough to ordinary send?
- If quote/build omits slippage, which user-selected or provider default value is the explicit fallback?
- Does review need risk, market-hours, or delayed-settlement copy?
- Does history display order lifecycle rather than on-chain confirmation?
- Are Market and Stock pending counts, filters, and list keys separated so one channel cannot badge or render the other channel's rows?
- Can token selectors, quote result rows, and history rows handle non-token identity without leaking token assumptions?
- Can local history survive app restart and then reconcile against broker/provider order status?

## Bridge/Limit Shared-Spine Drill

- Which visible entry surface launches the channel?
- Is the visible entry a merged surface such as Swap & Bridge?
- Which semantic value must remain distinct from the visible tab state and ordinary Swap after entry merge?
- Which default token/network rules apply only to this channel?
- Which history list should include or exclude the channel?
- Which status listener owns terminal state?
- Which analytics or monitor fields distinguish this channel from normal Swap?

## Market And K-Line Checklist

- Token detail enrichment, chart data, fallback chart data, and speed-swap execution payload are separate.
- Chart fallback cannot mutate quote state.
- Token selector live overrides cannot create a stale quote.
- WebView bridge events are scoped to the active chart/token.
- Desktop and native layout constraints are validated separately.

## Review Checklist

- Lead with confirmed behavior risk, not broad process notes.
- For each issue, name the state owner and failing transition.
- Distinguish code blockers from validation gaps.
- For Wallet Home, Home Token, Send, Market, Earn, or Buy entries into Swap,
  review both handoff params and the resulting Swap state transition before
  judging the target hook.
- Propose the smallest App-side change that preserves the canonical flow.
- Before patching a Stock/order review flag, check whether the behavior is already owned by a channel state, service adapter, backend DTO, generated workflow, or pending/history filter.

## Recent Failure-Derived Gates

Apply these as durable regression gates; recover current source before assuming
the original incident details still apply.

- Background/restart Stock failures require first-frame owner tracing: account
  readiness, restored `swapType`, Stock/pay pair, token-detail freshness, quote
  event, and ordinary Swap default sync are separate transitions.
- A provider minimum/error can render before another provider settles. Do not
  display a terminal error or zero result until quote-event progress proves no
  actionable quote remains.
- Fiat display must identify which token/currency owns the price. Never reuse a
  source amount with an unrelated target price or treat missing conversion as
  already converted.
- Disconnect is a visibility transition. Recent pairs and Swap/Limit/Stock
  history hide in `main`; persisted rows remain in bg SimpleDB and must return
  after reconnect, including after restart.
- Chart fixes must scope instance, token identity, currency/source currency,
  readiness, and cleanup. A mounted chart container is not proof that data or
  WebView events are current.
- Issue/PR titles are not authoritative scope. Inspect late Jira/Slack
  corrections, attachments, branch-only commits, and the actual PR file list;
  adjacent Stock, Market, Swap, or DeFi changes can be hidden in one squash.
