# Trade Entries And State Ownership

## Trace The Active Route

Start with the source entry, platform, and layout. Follow the component that
actually mounts, its quote/review owner, and its service calls. A filename such
as mobile or legacy does not prove which runtime uses it.

Market can embed shared Swap, open a shared Swap modal, or open a compact
trade dialog with a separate orchestration path. Where the entry already uses
shared Swap, keep quote/review/execution there and pass Market context through
typed extensions. Where it uses another live path, repair that owner and check
shared consumers; do not introduce a second state machine or force migration
just to match another layout.

Source entries own navigation intent, prefill, and return context. Downstream
trading owns the consumed selection and execution lifecycle. Preserve entry
metadata according to each endpoint's contract: analytics, quote, and build
source fields need not have the same meaning. Later source synchronization
must not continually overwrite the trade.

## Initialization And User Intent

Distinguish route seed, persisted channel selection, temporary display defaults,
server configuration, and manual edits. Establish which source is authoritative
at each stage before writing shared selection state. A late default response
must not overwrite an explicit route choice or the user's edited pair, yet an
amount edit alone may not mean the default pair is fully initialized.

Resolve readiness separately: account/address, networks, asset metadata,
provider capability, and quote can become ready at different times. A failed
configuration request is not a successful empty configuration. An automatic
retry can preserve usable UI without repeatedly surfacing an error toast;
manual actions still need actionable feedback and handled failures.

Check the first meaningful frame as well as the settled frame. A correct final
pair does not excuse a wrong token, tab, or icon flash. The visible tab and
internal execution/channel type can differ; do not repair one by overwriting
the other blindly.

## Identity And Cached Data

A result belongs to the inputs that change its meaning: account and actual
address/derivation, network and asset, direction/amount mode, amount, receiver,
slippage, provider/channel, and request or review generation as applicable.
Scope each cache or request to its own dependencies rather than copying an
unrelated global key.

For Stock, separate the stock identity, selected chain variant, and token.
Scope pay-token candidates, balances, and manual preferences to that selection;
clear incompatible network selections before accepting new candidates.
Display metadata may also depend on locale. A retained display snapshot cannot
authorize Max, quoting, or spending for an obsolete account or asset.

Keep usable same-scope data while it refreshes, and reject late results before
they can replace the cache's last valid value. Loading, provider failure,
unsupported capability, and an available fallback are different outcomes;
terminal unavailability must not remain behind an endless skeleton. Market
closure alone is not proof that every provider route is unavailable.

## Runtime And Service Boundary

Apply the platform topology in `AGENTS.md`; service ownership still matters on
single-runtime targets. Keep durable history writes with the existing
background owner. A UI visibility filter, local display cache, or modal state
must not become another persistence owner.
