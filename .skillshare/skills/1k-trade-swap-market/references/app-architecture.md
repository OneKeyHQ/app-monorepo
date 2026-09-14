# Trade / Swap Architecture

## Execution Spine

Trace every trade-like path through:

`entry -> account/asset selection -> quote -> frozen review -> build/sign/send -> history/status`

Swap is the shared execution spine. Bridge, Limit, Stock/order, privacy/order,
and Market speed-trade flows may adapt capability and settlement semantics,
but they must declare how they use or intentionally diverge from each stage.

## Entry Ownership

| Entry                   | Source owns                                          | Swap owns after mount/quote                       |
| ----------------------- | ---------------------------------------------------- | ------------------------------------------------- |
| Wallet or Home Token    | navigation, imported network/token, analytics source | selected state, quote, review, execution, history |
| Send/Earn/Buy           | source intent, amount/prefill, return context        | quote onward                                      |
| Market detail           | market token context and presets                     | executable payload onward                         |
| Direct Swap route/modal | route seed and host                                  | full Swap state machine                           |
| Receive selector        | Receive/AssetSelector filtering before handoff       | only after a real Swap route mounts               |

Route params are one-shot inputs. After consumption, current manual selection
and channel-owned state win over later source/account synchronization.

## Embedded Market / Stock Trade

An embedded Market or Stock surface is an entry adapter, not a second trade
implementation. It may keep its detail/chart shell and pass typed context such
as the selected variant, configuration, sizing, or presentation slots, while
the shared Swap surface owns quote, refresh, review, build/send, fallback, and
history lifecycle. Do not duplicate quote, review, action, or input state.

When a route, asset, variant, or network changes, key the transition by the
complete route and execution identity. Keep the shared trade surface mounted
when a partial refresh is part of the lifecycle, reuse in-flight state only for
the same identity, and clear incompatible pay-token state before resolving new
candidates. Treat transient readiness, provider error, terminal unsupported,
and actionable fallback as distinct states; terminal unavailability must not be
left behind an indefinite loading placeholder.

## State Boundaries

Keep these owners distinct:

- visible tab versus internal execution/capability type
- source and target account/network/token/receiver
- cached first-frame display versus trade readiness
- quote event progress versus selected actionable quote
- mutable page state versus frozen review state
- local history visibility versus background persistence
- tx settlement versus provider/order lifecycle

## Platform Runtime

iOS, Android, and browser extension run `main` and `bg` in isolated JavaScript
runtimes. They initialize independently; proxy/event payloads are serialized
copies. Native storage or other native resources can be process-shared, while
the background SimpleDB/service owner remains the sole writer.

Desktop and web run App `main` and `bg` code in one JavaScript runtime/thread.
Keep service and persistence ownership, but do not apply split-heap reasoning
or independent-JS-runtime deserialization assumptions to them.

## Cold Start And First Frame

Inspect both the first meaningful frame and the settled frame. Track route
seed, account readiness, persisted channel/display context, selected assets,
visible tab, internal execution type, provider data, and quote readiness
separately. Expected default assets come from current configuration and code,
not from this skill.

A cache can improve display without authorizing quote/build/send. A fix is not
verified if a wrong token/tab/icon flashes before the final state settles.
Restored channel-owned execution type and asset selection must win over an
ordinary Swap default initializer; resolve ownership before any default path
writes shared selection state.
