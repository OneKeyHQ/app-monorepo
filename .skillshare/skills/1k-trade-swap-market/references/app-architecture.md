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
