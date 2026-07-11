# OK-57887 Perps Deposit Token List Merge Design

## Goal

Fix the Perps deposit token selector so its rendered list is the union of:

1. the server-configured default deposit tokens; and
2. the eligible wallet-home token list for the active account.

The fix must preserve the filtering introduced for OK-57824 while ensuring a
new or empty account still sees the server default deposit tokens.

## Reproduction and Success Criteria

Desktop reproduction on a zero-balance account:

1. Open Perps.
2. Open Deposit.
3. Open the deposit token selector.

Current failure: the selector renders zero token rows and shows `No Results
Found` even though the server config supplied default deposit tokens.

Passing behavior:

- A zero-balance account renders the server default deposit tokens.
- A funded account renders eligible wallet-home tokens plus any missing server
  default tokens.
- A token present in both sources renders once.
- A non-default wallet token filtered by the existing fiat-value rule remains
  hidden.
- Account switching, cold-cache refresh, and modal reopen do not show another
  account's wallet balances.

## Current Data Flow and Root Cause

`ServiceHyperliquid.parseDepositConfig()` writes the server token map and the
separate `defaultTokens` array into `perpsDepositTokensAtom`.

`ServiceWebviewPerp.fetchPerpsDepositTokensFromWalletTokenList()` then fetches
the wallet-home token list for every server-supported network. Its result is
filtered, sorted, cached, and written back to the same atom.

The account-scoped write replaces `tokens` with the wallet-only map. The
`defaultTokens` array survives, but it is only used as a selected-token hint.
The service result returned to `DepositWithdrawModal` is also wallet-only, so
the selector never receives the server default list. A new account therefore
renders an empty selector after all zero-fiat wallet tokens are filtered out.

## Design

### Source ownership

The background service remains the owner of the final list. The UI must not add
a display-only fallback.

- Server config owns supported networks, default token identities, and default
  metadata.
- The wallet-home token flow owns account-scoped balance, price, fiat value,
  visibility, risk, and small-balance filtering.
- The persisted cold cache continues to store wallet-derived data only.
- The server defaults are merged after a cache read or network fetch, so a
  server config update does not require invalidating wallet balance cache data.

### Merge rule

The final list is:

```text
server default tokens UNION filtered wallet-home tokens
```

Token identity is the normalized pair of `networkId` and `contractAddress`.
Contract addresses are compared case-insensitively; the empty native-token
address remains a valid identity.

Ordering is deterministic:

1. eligible wallet-home tokens retain their existing descending fiat-value
   order;
2. server default tokens not already present are appended in server order.

When a token exists in both sources, it renders once. Server metadata is the
base object so `isDefault` and configured identity metadata are preserved. The
wallet object then overrides live fields, including `balanceParsed`, `price`,
`fiatValue`, logos, symbol, name, decimals, and native-token status.

### Atom and service result

The same merged data must be used for both outputs of the background owner:

- the account-scoped `perpsDepositTokensAtom.tokens` map; and
- the `tokens` and `tokensByNetwork` returned to the main runtime.

This prevents the atom from containing defaults while the modal-local list
still receives wallet-only data.

The existing `depositTokenListOwnerKey`, revision, and write-generation guards
remain authoritative. A stale account response must be rejected before merged
data is published.

### Runtime model

- `bg` fetches wallet data, reads server defaults, performs the merge, and owns
  cache and stale-write guards.
- `main` receives a serialized copy of the merged token array and renders it.
- The JS heaps are separate; neither runtime shares token objects by reference.
- SimpleDb is the shared native-backed persistent cache resource, but it stores
  wallet-derived data rather than the merged server-config view.
- Main and bg initialize independently. The merge must work for fresh network
  data, memory cache, cold cache, and background refresh without assuming main
  readiness.

## Error Handling

Existing partial-network behavior remains unchanged: failure to resolve one
network account does not remove successful networks. If all wallet requests
fail or return no eligible tokens, server defaults still form a valid list.

The fix must not bypass account ownership checks, risk-token filtering,
small-balance filtering, or the OK-57824 fiat-value filter.

## Testing

Add focused background tests that first fail on the current implementation:

- empty wallet list returns server defaults;
- funded wallet list appends missing defaults;
- a duplicate token renders once with live wallet values and the server default
  marker;
- filtered non-default wallet tokens are not reintroduced;
- network grouping contains the merged list;
- stale owner/write-generation behavior remains unchanged.

Run the focused Jest files, the repository commit profile, and the desktop CDP
scenario. Desktop verification must assert a positive
`perp-deposit-token-item` count on the reproduced zero-balance account and must
capture the final selector state plus console errors.

## Scope

This change does not modify deposit execution, Relay quote/status contracts,
minimum-deposit calculation, translations, visual styling, or navigation.
