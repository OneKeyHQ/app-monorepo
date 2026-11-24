import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import type { IAccountHistoryTx } from '@onekeyhq/shared/types/history';

import { selectVisibleHistoryRows } from './historyTopFreezeUtils';

import type { IUseFrozenTopHistoryDataResult } from './useFrozenTopHistoryData.types';

// Native fix for OK-57070. See `historyTopFreezeUtils.ts` for the root-cause
// notes. While the user is scrolled away from the top, rows that a background
// refresh prepends are held back so the viewport can't be shifted (no jitter);
// they merge in automatically once the user scrolls back near the top, where
// inserting above is visually safe.
//
// NativeHistoryList reports its own scroll threshold crossings through
// `onAwayFromTopChange`; the freeze state stays independent of pager context.
export function useFrozenTopHistoryData(
  combined: IAccountHistoryTx[],
  enabled: boolean,
  identityKey: string,
): IUseFrozenTopHistoryDataResult {
  // An identity switch (account / network / all-networks scope / filter
  // toggle) replaces the history stream instead of refreshing it, so the
  // previous freeze must stop applying in the very render that carries the new
  // identity: tx ids the new context happens to reuse would otherwise count as
  // "already displayed" and its legitimate top rows would be withheld until
  // the user scrolls back up (`selectVisibleHistoryRows`' wholesale-replacement
  // bail-out only covers streams with zero id overlap). The switch voids the
  // away state outright rather than scoping it to a key: a key comparison
  // would revive the freeze on a K0 -> K1 -> K0 round trip (e.g. toggling a
  // history filter off again) with the intermediate identity's rows as the
  // baseline. The list's scroll threshold state is intentionally NOT re-synced:
  // while it stays stale no away=true crossing can fire, so freezing stays off
  // for the new stream until the user returns near the top once — by which
  // point the baseline belongs to the new stream.
  const [isAway, setIsAway] = useState(false);
  const [awayIdentityKey, setAwayIdentityKey] = useState(identityKey);
  if (awayIdentityKey !== identityKey) {
    setAwayIdentityKey(identityKey);
    setIsAway(false);
  }
  const isAwayFromTop = enabled && isAway && awayIdentityKey === identityKey;

  // The rows are derived during render, never synced from an effect: an
  // effect-synced copy lags the upstream list by a commit, so an identity
  // switch would paint the previous identity's rows (and the empty state once
  // the new rows land with `initialized` already true) before catching up.
  // Always re-derive when the upstream list changes; no content-equality
  // short-circuit. `combined` is delivered from the background runtime via
  // backgroundApiProxy (ServiceHistory.fetchAccountHistory is a
  // @backgroundMethod), so it is re-serialized into brand-new objects on every
  // poll — row identity never survives the bg -> main hop, making any per-row
  // reference/id skip a no-op in production that would only mask legitimate
  // in-place updates (pending -> confirmed/replaced, backfilled fields). When
  // the list is not frozen the result IS `combined`, so the consumer still
  // bails out when the upstream list reference is unchanged. Re-rendering the
  // same ids in place never re-inserts at the top, so it cannot reintroduce
  // the OK-57070 jitter (only the held-back leading rows can cause that).
  const displayedRef = useRef(combined);
  const displayed = useMemo(
    () =>
      selectVisibleHistoryRows({
        combined,
        // The baseline is the last committed selection.
        displayed: displayedRef.current,
        isAwayFromTop,
        enabled,
      }),
    [combined, isAwayFromTop, enabled],
  );
  useLayoutEffect(() => {
    displayedRef.current = displayed;
  }, [displayed]);

  // When the gate turns off (list not being viewed) the render above already
  // returns the live list; also clear the away state so re-focusing always
  // starts unfrozen.
  useEffect(() => {
    if (!enabled) {
      setIsAway(false);
    }
  }, [enabled]);

  const onAwayFromTopChange = useCallback((away: boolean) => {
    setIsAway(away);
  }, []);

  return { displayedHistoryData: displayed, onAwayFromTopChange };
}
