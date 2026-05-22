import { useMemo, useRef } from 'react';

import BigNumber from 'bignumber.js';

import {
  buildOverviewOwnerKey,
  useAccountWorthAtom,
  useLastConfirmedOverviewBalanceAtom,
} from '../states/jotai/contexts/accountOverview';
import { useActiveAccount } from '../states/jotai/contexts/accountSelector';

export type IHomeBalanceState = 'unknown' | 'zero' | 'positive';

// Two sources, in order of preference:
//   1. `byOwner[ownerKey]` — per-account confirmed snapshot, MMKV-persisted, so
//      a returning session has the right answer on the first render.
//   2. `accountWorth` (live, sum of worth values) — needed because the balance
//      number on screen reads from this atom in real time, while `byOwner` is
//      only written after the "fully ready" signal. Without this fallback, the
//      header can show a real balance number while we still report `unknown`,
//      hiding the action row and banner until the slow confirmation completes.
// A `sticky` ref keeps the last non-`unknown` state for the brief moment
// during account switches when neither source has data for the new owner yet.
export function useHomeBalanceState(): IHomeBalanceState {
  const {
    activeAccount: { wallet, account, network, indexedAccount },
  } = useActiveAccount({ num: 0 });
  const [{ byOwner }] = useLastConfirmedOverviewBalanceAtom();
  const [accountWorth] = useAccountWorthAtom();

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

  const computed = useMemo<IHomeBalanceState>(() => {
    if (!wallet) return 'unknown';
    if (cached !== undefined) {
      return new BigNumber(cached).isZero() ? 'zero' : 'positive';
    }
    if (liveIsPositive === undefined) return 'unknown';
    return liveIsPositive ? 'positive' : 'zero';
  }, [wallet, cached, liveIsPositive]);

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
