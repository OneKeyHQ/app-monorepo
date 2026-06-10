import { useMemo, useRef } from 'react';

import BigNumber from 'bignumber.js';

import { appEventBus } from '@onekeyhq/shared/src/eventBus/appEventBus';
import { EAppEventBusNames } from '@onekeyhq/shared/src/eventBus/appEventBusNames';
import type { IAccountToken, ITokenFiat } from '@onekeyhq/shared/types/token';

import {
  buildOverviewOwnerKey,
  useAccountWorthAtom,
  useLastConfirmedOverviewBalanceAtom,
} from '../states/jotai/contexts/accountOverview';
import { useActiveAccount } from '../states/jotai/contexts/accountSelector';
import {
  useAllTokenListAtom,
  useFlattenAggregateTokensMapAtom,
  useSmallBalanceTokenListAtom,
  useSmallBalanceTokenListMapAtom,
  useTokenListAtom,
  useTokenListMapAtom,
} from '../states/jotai/contexts/tokenList';

export type IHomeBalanceState = 'unknown' | 'zero' | 'positive';

// Module-scoped so every hook instance shares one latch — WalletActions
// remounts when a wallet's backup state flips, and a per-instance latch
// would let the header (still latched) and a freshly mounted action row
// disagree mid-refresh. Keyed by `${accountId}__${networkId}`.
const fundedOwners = new Set<string>();

// `account.id` is deterministically derived from key material (HD:
// `${walletId}--${path}`, imported: `imported--${coinType}--${publicKey}`), so
// deleting a wallet and re-importing the same seed in one session reuses the
// identical id. Without eviction, an address emptied before that re-import
// would hit a stale "funded" latch and wrongly show Send/Swap instead of the
// Add-money state — the opposite of this hook's intent. Clear wholesale on
// removal (cheap; still-funded owners re-latch on their next render where the
// live scan sees their balance). Registered once at module load; mirrors the
// cache-eviction pattern in ServiceFreshAddress / ServiceNotification. NOT
// cleared on WalletUpdate — that fires on renames etc. and would defeat the
// anti-flap latch during routine refreshes.
appEventBus.on(EAppEventBusNames.WalletRemove, () => fundedOwners.clear());
appEventBus.on(EAppEventBusNames.AccountRemove, () => fundedOwners.clear());

// Three sources:
//   1. Held tokens (risk-filtered token list) — a "funded" override, latched
//      per owner for the session. Fiat worth is a partial sum: tokens without
//      price data contribute nothing (custom networks hardcode fiatValue '0',
//      long-tail tokens may have no price feed), so worth === 0 does NOT mean
//      the wallet is empty. `zero` (the Add-money onboarding state, which
//      also replaces Send/Swap) requires BOTH worth == 0 AND no held tokens.
//   2. `byOwner[ownerKey]` — per-account confirmed snapshot, MMKV-persisted, so
//      a returning session has the right answer on the first render.
//   3. `accountWorth` (live, sum of worth values) — needed because the balance
//      number on screen reads from this atom in real time, while `byOwner` is
//      only written after the "fully ready" signal. Without this fallback, the
//      header can show a real balance number while we still report `unknown`,
//      hiding the action row and banner until the slow confirmation completes.
// A `sticky` ref keeps the last non-`unknown` state for the brief moment
// during account switches when neither source has data for the new owner yet.
//
// Requires the tokenList jotai context (HomeTokenListProviderMirror) in scope.
export function useHomeBalanceState(): IHomeBalanceState {
  const {
    activeAccount: { wallet, account, network, indexedAccount },
  } = useActiveAccount({ num: 0 });
  const [{ byOwner }] = useLastConfirmedOverviewBalanceAtom();
  const [accountWorth] = useAccountWorthAtom();
  const [tokenList] = useTokenListAtom();
  const [smallBalanceTokenList] = useSmallBalanceTokenListAtom();
  const [tokenListMap] = useTokenListMapAtom();
  const [smallBalanceTokenListMap] = useSmallBalanceTokenListMapAtom();
  const [aggregateTokensMap] = useFlattenAggregateTokensMapAtom();
  const [allTokenList] = useAllTokenListAtom();

  const ownerKey = buildOverviewOwnerKey(account?.id, network?.id);
  const cached = ownerKey ? byOwner[ownerKey] : undefined;

  // Short-circuit positivity check instead of summing — the AllNetworks
  // refresh fires per-network `setAccountWorth` calls (~30 writes per refresh
  // on a multi-chain wallet), and a full sum would do ~30 BigNumber allocs
  // per write, per subscriber. Downstream only needs the zero/positive
  // bucket, so first non-zero entry wins.
  const liveIsPositive = useMemo<boolean | undefined>(() => {
    if (!accountWorth.initialized) return undefined;
    const isForCurrent =
      accountWorth.accountId === account?.id ||
      accountWorth.accountId === indexedAccount?.id;
    if (!isForCurrent) return undefined;
    const values = Object.values(accountWorth.worth);
    if (values.length === 0) return undefined;
    for (const v of values) {
      if (v && v !== '0' && !new BigNumber(v).isZero()) return true;
    }
    return false;
  }, [
    accountWorth.initialized,
    accountWorth.accountId,
    accountWorth.worth,
    account?.id,
    indexedAccount?.id,
  ]);

  // Any held token (balance > 0) counts as funded, regardless of valuation.
  // Scans the `tokenList` + `smallBalanceTokenList` buckets (which exclude
  // risk tokens — unlike `allTokenList`, which merges the risk bucket back
  // in, so a spam airdrop alone would read as funded) with the same
  // balance-resolution rule as TokenListView's zero-balance filter: per-token
  // map first, aggregate (All Networks) map as fallback. Guarded by
  // `allTokenList`'s owner stamp: the token list atoms live in a singleton
  // store and briefly carry the previous owner's data after an account
  // switch, and an unguarded scan would report the old account's holdings
  // for a freshly-switched empty one.
  const hasHoldingsNow = useMemo<boolean>(() => {
    if (!account?.id || !network?.id) return false;
    if (
      allTokenList.accountId !== account.id ||
      allTokenList.networkId !== network.id
    ) {
      return false;
    }
    const holdsPositiveBalance = (
      token: IAccountToken,
      map: Record<string, ITokenFiat>,
    ) => {
      const balance =
        map[token.$key]?.balance ?? aggregateTokensMap[token.$key]?.balance;
      return !!balance && balance !== '0' && new BigNumber(balance).gt(0);
    };
    return (
      tokenList.tokens.some((token) =>
        holdsPositiveBalance(token, tokenListMap),
      ) ||
      smallBalanceTokenList.smallBalanceTokens.some((token) =>
        holdsPositiveBalance(token, smallBalanceTokenListMap),
      )
    );
  }, [
    account?.id,
    network?.id,
    allTokenList.accountId,
    allTokenList.networkId,
    tokenList.tokens,
    smallBalanceTokenList.smallBalanceTokens,
    tokenListMap,
    smallBalanceTokenListMap,
    aggregateTokensMap,
  ]);

  // Session latch: once an owner is seen holding tokens, keep reporting
  // funded for that owner. The live scan cannot be trusted to go false —
  // every All-Networks init (owner switch, polling re-init, enabled-networks
  // change) wipes `tokenListAtom` while stamping the current owner, and
  // `tokenListState` reads "settled" after the FIRST per-chain response, so
  // there is no reliable mid-session "list complete and genuinely empty"
  // signal. Without the latch, a worth-0 wallet holding unpriced tokens
  // would flap positive→zero→positive on every refresh, resurfacing the
  // Add-money state (and hiding Send/Swap) for the whole multi-second init.
  // Trade-off: a wallet genuinely emptied mid-session keeps the full action
  // row until an app restart — mild and rare, vs. a recurring flap for the
  // exact population this override targets.
  const holdingsOwnerKey =
    account?.id && network?.id ? `${account.id}__${network.id}` : undefined;
  if (hasHoldingsNow && holdingsOwnerKey) {
    fundedOwners.add(holdingsOwnerKey);
  }
  const hasHoldings =
    hasHoldingsNow ||
    (!!holdingsOwnerKey && fundedOwners.has(holdingsOwnerKey));

  const computed = useMemo<IHomeBalanceState>(() => {
    if (!wallet) return 'unknown';
    if (hasHoldings) return 'positive';
    if (cached !== undefined) {
      return new BigNumber(cached).isZero() ? 'zero' : 'positive';
    }
    if (liveIsPositive === undefined) return 'unknown';
    return liveIsPositive ? 'positive' : 'zero';
  }, [wallet, hasHoldings, cached, liveIsPositive]);

  // Sticky must be wallet-scoped. Without the key check, switching from a
  // funded wallet to a freshly-imported $0 wallet keeps reporting 'positive'
  // until the new owner's `byOwner` cache and `accountWorth` both land
  // (OK-54527 upgrade-then-import regression). Keying on `wallet?.id`
  // (not `ownerKey`) preserves the original bridging intent for
  // account/network switches inside the same wallet — WalletActions relies
  // on that to avoid blanking the action row each tab switch.
  const walletKey = wallet?.id;
  const stickyRef = useRef<{
    key: string | undefined;
    state: IHomeBalanceState;
  }>({ key: undefined, state: 'unknown' });
  if (stickyRef.current.key !== walletKey) {
    stickyRef.current = { key: walletKey, state: 'unknown' };
  }
  if (computed !== 'unknown' && stickyRef.current.state !== computed) {
    stickyRef.current = { key: walletKey, state: computed };
  }

  return computed === 'unknown' ? stickyRef.current.state : computed;
}
