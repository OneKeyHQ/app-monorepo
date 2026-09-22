import { useMemo, useRef } from 'react';

import BigNumber from 'bignumber.js';

import { appEventBus } from '@onekeyhq/shared/src/eventBus/appEventBus';
import { EAppEventBusNames } from '@onekeyhq/shared/src/eventBus/appEventBusNames';

import {
  buildOverviewOwnerKey,
  useAccountWorthAtom,
  useLastConfirmedOverviewBalanceAtom,
} from '../states/jotai/contexts/accountOverview';
import { useActiveAccount } from '../states/jotai/contexts/accountSelector';
import { useListStructureAtom } from '../states/jotai/contexts/tokenList';

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
//   1. Held tokens (TokenList cells structure `fundedIds`, the STRICT
//      positive-balance / risk-filtered set) — a "funded" override, latched
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
  const [listStructure] = useListStructureAtom();

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
  // Reads the TokenList cells structure's `fundedIds` — the STRICT positive-
  // balance set (balance > 0 only, risk tokens excluded, aggregate-aware, with
  // NO keepDefault entries). This replaces the previous multi-atom live scan
  // (tokenList + smallBalanceTokenList + their maps + flatten-aggregate map).
  //
  // `fundedIds`, NOT `nonZeroIds`: nonZeroIds is the hideZero VIEW filter and
  // retains zero-balance default/custom tokens, so a fresh default-token
  // account would falsely read as funded and hide the Add-money state.
  //
  // Owner guard: the cells structure lives in a singleton store and briefly
  // carries the previous owner's data after an account switch. The structure's
  // `ownerKey` is keyed by the per-owner cache account id — the concrete
  // `account.id` normally, but the `indexedAccount.id` under
  // merge-derive-assets mode (see getTokenListOwnerCacheAccountId). Accept a
  // match against either candidate so merge-mode accounts are not silently
  // gated out; a stale previous owner's key matches neither (it carries a
  // different account/network) so the guard still holds.
  //
  // Cold-start / owner-mismatch window: `generation < 0` (no structure frame
  // applied yet) or an ownerKey mismatch yields `false` here; the final
  // composition below still resolves to `unknown` (loading) via byOwner cache
  // + liveIsPositive precedence, so a real account never flashes Add-money.
  const hasHoldingsNow = useMemo<boolean>(() => {
    if (!account?.id || !network?.id) return false;
    if (listStructure.generation < 0) return false;
    const structureOwnerMatches =
      listStructure.ownerKey === ownerKey ||
      (!!indexedAccount?.id &&
        listStructure.ownerKey === `${indexedAccount.id}__${network.id}`);
    if (!structureOwnerMatches) return false;
    return listStructure.fundedIds.length > 0;
  }, [
    account?.id,
    network?.id,
    indexedAccount?.id,
    ownerKey,
    listStructure.generation,
    listStructure.ownerKey,
    listStructure.fundedIds,
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
