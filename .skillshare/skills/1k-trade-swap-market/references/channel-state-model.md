# Channel State Model

Use this before adding or reviewing a Swap-owned channel whose lifecycle is not
fully represented by one normal on-chain transaction. This includes
PrivateSend-like provider orders, Bridge, Limit, stock/order channels, and
Market speed-swap variants.

## Execution Spine

Swap should stay the bottom execution spine:

`quote -> review snapshot -> build/sign/send -> local history -> status listener -> detail repair`

Entry surfaces can differ, but once a user submits a trade-like action the
channel must explain how it uses this spine. A surface such as Send, Market,
Earn, or Buy may prefill or launch the flow; it should not become the long-term
owner of order state unless the contract explicitly says so.

## Four State Ledgers

Every non-standard channel needs these ledgers in writing.

### 1. History Display

Define what the user should see, not only what the chain recorded:

- transaction type and list ownership
- visible asset rows and whether receive-side assets are hidden
- semantic receiver, provider settlement address, and chain `to` address
- provider name/logo/support URL
- network fee, provider fee, commission, spread, ETA, rate, and unknown display
- setup, activation, or auxiliary asset rows that should display separately
  from the main business transfer
- progress steps and final labels
- which ordinary Swap/Bridge/Market lists must include or exclude the channel

PrivateSend-like flows prove why semantic receiver and provider settlement
address must stay separate. Stock/order flows will need the same separation for
broker or venue settlement.

### 2. Channel Listener

Define which source updates status and when:

- local broadcast/send result
- normal `/swap/v1/state-tx` style status
- provider order detail by txid/order id
- account history replay
- websocket/SSE or polling interval
- terminal states and retry/stop conditions

Do not assume txid, order id, route id, and provider id are interchangeable.
If two listeners can update the same row, define priority and merge behavior.

### 3. Local Writeback

Define the App-side row created after submit:

- identity key: txid, order id, route id, provider id, or composite key
- initial status and progress step
- frozen quote/build fields copied into history
- gas/provider fee fields and whether missing means unknown
- provider raw context preserved for later status lookup
- typed display context when base swap fields cannot represent all semantic
  rows, fees, or receiver fields
- pending-list filters for Swap, Bridge, Market, and channel-specific lists

Send success without the correct local history row is not a complete channel
implementation. For order-backed channels, the history row should preserve
enough provider context to survive an app restart.

### 4. Replay And Repair

Define how stale, partial, or legacy rows are corrected:

- account history or notification entry opens the right detail route
- confirmed on-chain history can replace a local pending row without erasing
  locally decoded payload or extraInfo needed for channel display
- old simpleDb rows can be enriched without losing user-facing fields
- provider order detail can backfill amount, token, provider, rate, fee, status,
  and receiver fields
- replay can add missing semantic display rows only when the replay source is
  richer than the persisted row
- unknown values render as unknown, not zero
- merge rules avoid replacing a valid semantic receiver with a settlement
  address
- repair writes back only when the enriched row is actually different

This ledger is mandatory when a backend field is introduced after local rows
already exist, or when a channel can be opened from decoded account history
instead of the original submit path.

## Source Priority

Use this default priority unless the channel contract says otherwise:

1. User-confirmed semantic fields from the frozen review snapshot.
2. Provider/order detail fields that represent final business state.
3. Normal status endpoint fields for chain and provider progress.
4. Account history replay fields for recovery and missing local rows.
5. Local cached fields as fallback only.

Locally persisted review/build payload and decoded `extraInfo` are not generic
cache when they are the only source for semantic receiver, setup fee, or display
row metadata. Preserve them until a higher-priority source explicitly provides
the same semantic field.

Never let a lower-priority source overwrite a higher-priority semantic field
without an explicit migration or correction rule.

## New Channel Acceptance Note

Before implementation or review, write a short note:

```text
Channel:
Entry surface:
Capability:
Identity keys:
History display:
Setup/auxiliary fees:
Listener source:
Local writeback:
Replay/repair source:
Terminal states:
List inclusion/exclusion:
Unknown-value display:
Runtime payloads to inspect:
```

If this note cannot be completed, the channel is not ready for UI wiring.
