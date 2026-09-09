# Trade / Swap Code Map

Use directory-level orientation, then confirm current symbols with `rg`.

## Primary Areas

| Concern                         | Start here                                                          |
| ------------------------------- | ------------------------------------------------------------------- |
| Swap UI, hooks, review, history | `packages/kit/src/views/Swap/`                                      |
| Swap Jotai state/actions        | `packages/kit/src/states/jotai/contexts/swap/`                      |
| Quote/build/status service      | `packages/kit-bg/src/services/ServiceSwap.ts` and background API    |
| Persistent Swap history         | Swap SimpleDB entity and shared history types/utils                 |
| Routes and shared contracts     | `packages/shared/src/routes/swap.ts`, `packages/shared/types/swap/` |
| Wallet/Home/Send/Earn handoffs  | source view/component plus Swap route initialization                |
| Market speed-trade and data     | `packages/kit/src/views/Market/`, market background service         |
| Receive-only filtering          | Receive page, AssetSelector, shared token-selector filter utils     |
| TradingView/K-line              | TradingView component tree and market data/message handlers         |

## Useful Searches

Adapt these to the reported path:

```bash
rg -n "fetchQuotes|quoteEvent|selectedQuote|fetchBuild|orderId|txid" \
  packages/kit packages/kit-bg packages/shared
rg -n "importFromToken|importToToken|swapSource|swapType|tabSwitch" \
  packages/kit packages/shared
rg -n "history|pending|replay|repair|SimpleDbEntitySwap" \
  packages/kit packages/kit-bg packages/shared
rg -n "ReceiveSelector|TokenSelector|hideDeFi|showDeFi" \
  packages/kit packages/shared
rg --files packages/kit packages/kit-bg packages/shared | \
  rg '(Swap|Market|Stock|Bridge|Limit).*(test|spec)\.'
```

When a provider or server field controls behavior, inspect the current DTO,
adapter, and representative runtime payload. Store stable meaning in types and
tests; do not freeze one observed response in the skill.

## Package Boundaries

Keep shared code pure and minimal. `shared` imports no other OneKey packages;
`kit-bg` cannot import UI packages; channel UI belongs in `kit`, while shared
identity types/predicates may live in `shared` when both runtimes need them.
