# State And Routing

## Route Param Contract

Route params must preserve enough identity to reload the surface from a fresh app state:

- provider
- network id
- symbol/token
- vault, market, or reserve
- account id and indexed account id when needed
- operation type
- category or protocol variant
- return/success target when needed

Do not rely on volatile local state when a route can be opened by share, deep link, browser handoff, or tab restore.

AssetDetails modal routes are not guaranteed to share Home tab providers.
When a DeFi position row opens an AssetDetails modal such as
`DeFiProtocolDetails`, pass account and indexed-account identity through typed
route params or the protocol payload itself. Do not read Home-only account
selector context from the modal unless the target stack mounts the matching
provider mirror.

## Native Host Rules

Native Earn is hosted under Discovery. Desktop/web use the Earn tab route.

When navigating to Earn on native:

- switch Discovery host before pushing the Earn sub-route
- avoid stack accumulation from repeated pushes
- validate fresh native open, not only same-tab navigation
- check modal and bottom-sheet safe areas

Entry ownership rules:

- Home Earn cards/lists, share links, and portfolio rows are entry surfaces.
  They own params and analytics source, not long-term Earn data state.
- `EarnHome` on native is a Discovery sub-tab switch, while
  `EarnProtocols`/`EarnProtocolDetails` are stack routes under Discovery.
- AssetDetails modal action routes must preserve account identity in route
  params or protocol payloads; do not assume the Home account provider is
  mounted.
- Swap-assisted actions must stop at prefill/source context. Once Swap quote
  starts, use `1k-trade-swap-market` for execution, pending, and Swap history.

## Fresh Entry And Cold Start

For fresh app state, first native open, share/deep link, notification entry, or
tab restore, validate that the route can reload without volatile source-route
state.

- Home Earn cards/lists own entry params and analytics source only.
- Native EarnHome is a Discovery sub-tab switch; native detail/list routes are
  pushed under Discovery after the host is ready.
- AssetDetails and DeFi Portfolio action routes carry account id and indexed
  account id through params or payload.
- Operation dialogs must show bounded loading/disabled states while account,
  provider, position, or supported-action data is incomplete. They should not
  expose an executable button or wrong unsupported state before readiness.
- Swap-assisted entry can prefill Swap only once. Return refresh is DeFi-owned;
  Swap execution readiness is not.

## Data Ownership

Name the owner for each data class:

- home overview
- home recommendations
- available assets
- portfolio investments
- protocol detail
- borrow markets
- borrow reserves
- operation form
- pending transactions
- history rows
- route params

Do not let operation modals mutate portfolio caches directly unless the cache owner exposes that refresh path.

Earn recommendations, available assets, and portfolio investments are separate
owners. Before changing Earn home fetch or refresh behavior, decide which owner
is changing. Do not treat an available-assets `refreshTrigger` as a
recommended-list refresh unless the current component contract explicitly says
so.

## Request Staleness

Guard refresh and request identity by:

- account
- network
- provider
- symbol/token
- vault/market/reserve
- operation type
- focused route or visible content state

If the user changes account or route while data is loading, stale responses must not update the new surface.

Earn tab content can stay mounted while hidden. For recommended assets and
available assets, propagate explicit `isActive` or visible-content state from
the host and tab layer into fetch consumers. Gate promise focus overrides,
throttled fetch callbacks, and user-triggered search fetches on that state;
focus or first-mount checks alone are not enough.

## Pending And History

Pending/history depends on the staking info contract:

- tag builders identify affected positions
- labels drive history row text and pending indicators
- filters scope history to the right provider/account/protocol
- completion delay and refresh target are explicit

Pending is not just a spinner. It is the bridge between send success, portfolio refresh, detail refresh, and history.

## Platform Layout

Validate the platform that owns the issue:

- desktop tab
- web route
- extension popup
- native Discovery host
- native modal/bottom-sheet
- tablet/iPad layout

Responsive fixes should be local to the DeFi surface unless the shared component is the proven owner.

## i18n

All user-facing strings use the repository i18n workflow. Do not hand-edit generated locale files. Use `/1k-i18n` when adding keys or reviewing translation behavior.
