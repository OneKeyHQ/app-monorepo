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

## Quote Selection

Bind each result to the active request/event and full trade identity. When
providers race, an early error is not terminal while the current event can
still return an actionable quote. Once identity changes, ignore late results.
Manual provider selection remains authoritative until invalidated by a real
capability or identity change.

For every displayed field, define its source and missing-value meaning.
Unknown fee/rate/ETA/limit is not zero, and provider unavailable is not an
empty successful quote.

## Review And Submission

Freeze the chosen quote, assets, accounts, receiver, provider, fees, rate,
slippage, limits, risk text, and setup requirements. Confirmation must not
read changing page atoms. After send/order submission, create the correct
pending/history identity before relying on status polling.

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
