# App Architecture

## Canonical Flow

Every Trade/Swap/Market execution path should be mapped before editing:

`selection/account -> quote -> review snapshot -> build/sign/send -> pending history/status`

The App can expose the same execution through different surfaces, but the data ownership checkpoints stay stable.

Swap should be treated as the shared execution spine for trade-like channels.
Bridge, Limit, PrivateSend-like provider orders, stock/order channels, and
Market speed-swap can adapt entry and settlement semantics, but they should not
duplicate quote/review/build/history/status ownership in isolated surfaces.

## Surfaces

- Swap page and Swap Pro own the standard token-to-token interaction.
- Market speed-swap starts from market token detail, then builds a Swap execution payload.
- Swap K-line/chart is data and display, not execution. Keep chart data fallback separate from quote/build state.
- Review/Confirm owns the frozen transaction summary and approval/setup state.
- History/detail owns pending rows, provider status, progress text, and fallback price data.
- Cross-module handoffs can prefill Swap state, but must not become the source of truth after quote starts.

## Selection And Account Resolution

Resolve these identities separately:

- from account and to account
- source network and target network
- token identity, native token identity, and wrapped token identity
- receiver address, privacy receiver, and provider-owned settlement target
- manual provider selection and provider capability filters

Do not infer target account support from the source account alone. All Networks, account derive type, and native/wrapped token handling are separate failure lanes.

## Quote Pipeline

The quote pipeline owns quote request identity and stale response guards:

- event id or request id
- provider key
- source and target token keys
- amount mode
- manual provider selection intent
- quote progress and quote completion state

When multiple providers race, only the active request/provider/token tuple can update the selected quote. Do not let an older quote replace the current quote after account, network, provider, or amount changes.

## Review Snapshot

Review must freeze the quote/build inputs that the user confirms:

- from/to token, amount, network, account, receiver
- provider, route, fee, rate, slippage, ETA, limits
- approval/setup requirements
- warning/risk text and provider-specific display

The review state should not keep reading mutable page atoms after the user enters confirm.

## Build, Sign, And Send

Build/send can return different execution types:

- normal unsigned transaction
- approval/setup transaction plus business transaction
- order payload with later settlement
- provider-managed privacy or order flow
- Market speed-swap payload derived from market detail

Keep build response parsing, transaction send, and post-send history creation in one traced path. A send success without the correct pending history item is not validated.

## History And Status

History/status must define:

- pending item identity
- txid and order id roles
- provider raw status to App final status
- progress-step labels
- detail-page fallback data
- polling end conditions and retry behavior
- replay/enrichment source for partial local rows
- correction behavior when backend detail arrives after local submit

PrivateSend-like channels often need order progress even when normal
transaction status is unavailable. Stock/order channels often need order
lifecycle states that are not equivalent to on-chain success.

See [channel-state-model.md](channel-state-model.md) before changing list
filters, status polling, detail display, or history replay for a non-standard
channel.

## Market Detail And K-Line

Market detail flows have separate data boundaries:

- token detail enrichment
- token selector and live token overrides
- chart/K-line data and fallback data
- transaction stream and holders/portfolio panels
- speed-swap execution payload

Do not fix a chart fallback issue by changing quote state, and do not fix a quote issue by changing chart data ownership.

## Extension Decision Tree

Use this when a new channel appears:

1. Can it execute a normal token swap with existing quote/build/status fields? Add or adjust a provider adapter.
2. Does it hide receiver or settlement details, or use provider-managed progress? Treat it as an order-backed privacy channel.
3. Does it trade a non-token or stock-like asset? Define asset identity, session availability, settlement currency, and order statuses first.
4. Is it only a funding entry into Swap? Keep the source surface as prefill only; Swap owns execution after quote starts.
5. Is it only data display? Keep it in Market/K-line data flow and do not add execution state.
6. Does it share Swap infrastructure but need different history or listener
   semantics? Add a channel-state contract before reusing ordinary Swap lists
   or status polling.
