# Swap Provider And Channel Contracts

Use this when quote/build/history behavior differs from an ordinary on-chain
swap, including Bridge, Limit, Stock/order, privacy/order, and broker flows.

## Contract

| Area                | Required decisions                                                               |
| ------------------- | -------------------------------------------------------------------------------- |
| Capability          | swap, bridge, limit, stock/order, privacy/order, funding handoff, or data-only   |
| Asset/account roles | source and target asset/network/account, signer, receiver, settlement target     |
| Quote identity      | request/event, provider, tokens/assets, amount mode, receiver, slippage/session  |
| Quote fields        | units, limits, fees, rate, ETA, availability, and meaning of missing values      |
| Review              | fields frozen for confirmation, setup/approval, risk and settlement copy         |
| Build/send          | normal tx, setup then business tx, signed/order payload, provider-managed action |
| Lifecycle identity  | txid, order id, route id, provider id, or explicit composite key                 |
| Persistence         | local row owner, initial status, fields preserved across restart                 |
| Replay/repair       | status source, merge priority, terminal mapping, stop/retry behavior             |

A data-only channel must not create transaction or history state. A response
shape that does not fit an existing variant should get a typed adapter instead
of conditionals spread through UI components.

## Embedded Market Contract

An embedded Market surface may adapt the entry pair and Market-only display
slots, but the shared Swap channel remains the owner of quote polling, refresh,
review/build, fallback navigation, and execution. Document each extension's
source and lifecycle; do not pass a second loading/disabled model that can
suppress a valid Swap fallback. Keep the detail shell separate from the trade
surface without copying ticket state.

Stock/order identity includes the selected asset/variant and network. Scope
pay-token candidate lists, manual preferences, balances, and selector contents
to that identity; reject late results from a previous identity. For native pay
tokens, subtract the network's gas reserve from the raw balance once, then
apply percentage presets to the resulting available balance. Do not subtract
the full reserve again from a partial slice.

Readiness may be staged (asset metadata, market availability, pay-token
candidates, then quote readiness). A closed market is not automatically a
missing quote when the provider still supports an on-chain or liquidity path;
use the current channel status and provider contract. Carry the complete
execution identity through review, build, and history.

## Quote Selection

Bind each result to the active request/event and full trade identity. When
providers race, an early error is not terminal while the current event can
still return an actionable quote. Once identity changes, ignore late results.
Manual provider selection remains authoritative until invalidated by a real
capability or identity change.

Transient config/quote loading, terminal unsupported capability, provider error,
and actionable fallback are separate states. An initial/default speed
configuration is only a display/input hint; only a network-scoped ready
configuration authorizes quote/build. It must not become an endless skeleton;
an unsupported embedded trade should render an explicit unavailable state or
the full Swap fallback when that route is valid.

For every displayed field, define its source and missing-value meaning.
Unknown fee/rate/ETA/limit is not zero, and provider unavailable is not an
empty successful quote.

## Review And Submission

Freeze the chosen quote, assets, accounts, receiver, provider, fees, rate,
slippage, limits, risk text, and setup requirements. Confirmation must not
read changing page atoms. After send/order submission, create the correct
pending/history identity before relying on status polling.

If an embedded flow enters approval or confirmation, keep it alive by a flow
identity tied to the mounted trade context, not only the currently focused
modal or tab. Close the originating review layer before opening a fallback
confirmation layer; never leave two competing dialogs to own the same submit.

## History, Replay, And Repair

For flows that outlive the submit screen, define:

1. semantic fields copied from the review/build result
2. sole local writer and persisted identity
3. listener or polling source and terminal states
4. restart/account-history/notification replay source
5. merge priority when a richer provider or backend detail arrives

Preserve semantic receiver, asset, fee, and provider fields until a
higher-priority source explicitly replaces the same meaning. On-chain data
must not erase richer order/channel context. Repair only when the merged row
actually differs.

Visibility is a separate concern: hiding local rows during disconnect or an
unready account state must not call delete/clean persistence paths.

For order/history channels, define the terminal matrix explicitly (success,
failed, canceled/canceling, expired, refunded, and any provider-specific
terminal state). Preserve source, target, replacement, and refund IDs for the
detail view; stop polling and replacement actions at the terminal boundary,
and do not render a second transaction ID unless the status contract says it is
the source, replacement, or refund transaction. Treat a refunded transition as
balance-changing only when the status source marks it that way; failed or
expired terminal states do not by themselves imply a balance refresh.
