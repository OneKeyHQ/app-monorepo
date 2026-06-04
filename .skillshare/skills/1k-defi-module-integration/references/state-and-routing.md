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

## Native Host Rules

Native Earn is hosted under Discovery. Desktop/web use the Earn tab route.

When navigating to Earn on native:

- switch Discovery host before pushing the Earn sub-route
- avoid stack accumulation from repeated pushes
- validate fresh native open, not only same-tab navigation
- check modal and bottom-sheet safe areas

## Data Ownership

Name the owner for each data class:

- home overview
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
