import { useCallback, useEffect, useRef, useState } from 'react';

import {
  runOnJS,
  useAnimatedReaction,
  useSharedValue,
} from 'react-native-reanimated';

import { useCurrentTabScrollY } from '@onekeyhq/components';
import type { IAccountHistoryTx } from '@onekeyhq/shared/types/history';

import {
  FREEZE_ENGAGE_OFFSET,
  FREEZE_RELEASE_OFFSET,
  selectVisibleHistoryRows,
} from './historyTopFreezeUtils';

import type { SharedValue } from 'react-native-reanimated';

// Native fix for OK-57070. See `historyTopFreezeUtils.ts` for the root-cause
// notes. While the user is scrolled away from the top, rows that a background
// refresh prepends are held back so the viewport can't be shifted (no jitter);
// they merge in automatically once the user scrolls back near the top, where
// inserting above is visually safe.
export function useFrozenTopHistoryData(
  combined: IAccountHistoryTx[],
  enabled: boolean,
): IAccountHistoryTx[] {
  const scrollY = useCurrentTabScrollY();

  const [displayed, setDisplayed] = useState<IAccountHistoryTx[]>(combined);
  const displayedRef = useRef(displayed);
  const combinedRef = useRef(combined);
  const isAwayFromTopRef = useRef(false);
  // Worklet-side mirror of the freeze state so the scroll reaction only hops to
  // JS on an actual threshold crossing, not on every scroll frame.
  const isAwaySharedValue = useSharedValue(false);

  const apply = useCallback(() => {
    const next = selectVisibleHistoryRows({
      combined: combinedRef.current,
      displayedIds: new Set(displayedRef.current.map((tx) => tx.id)),
      isAwayFromTop: isAwayFromTopRef.current,
      enabled,
    });
    // Always sync the freeze-selected rows; no content-equality short-circuit.
    // `combined` is delivered from the background runtime via backgroundApiProxy
    // (ServiceHistory.fetchAccountHistory is a @backgroundMethod), so it is
    // re-serialized into brand-new objects on every poll — row identity never
    // survives the bg -> main hop, making any per-row reference/id skip a no-op
    // in production that would only mask legitimate in-place updates
    // (pending -> confirmed/replaced, backfilled fields). When the list is not
    // frozen `next === combinedRef.current`, so React still bails out of the
    // re-render when the upstream list reference is unchanged. Re-rendering the
    // same ids in place never re-inserts at the top, so it cannot reintroduce
    // the OK-57070 jitter (only the held-back leading rows can cause that).
    displayedRef.current = next;
    setDisplayed(next);
  }, [enabled]);

  // Re-evaluate whenever the upstream merged list changes (poll / load-more).
  useEffect(() => {
    combinedRef.current = combined;
    apply();
  }, [combined, apply]);

  // When the gate turns off (list not being viewed) force the live list and
  // clear any stale "away" state so re-focusing always starts unfrozen.
  useEffect(() => {
    if (!enabled) {
      isAwayFromTopRef.current = false;
      isAwaySharedValue.value = false;
      apply();
    }
  }, [enabled, apply, isAwaySharedValue]);

  const onAwayFromTopChange = useCallback(
    (away: boolean) => {
      isAwayFromTopRef.current = away;
      apply();
    },
    [apply],
  );

  useAnimatedReaction(
    () => (scrollY as SharedValue<number>).value,
    (y) => {
      'worklet';

      let away = isAwaySharedValue.value;
      if (!away && y > FREEZE_ENGAGE_OFFSET) {
        away = true;
      } else if (away && y < FREEZE_RELEASE_OFFSET) {
        away = false;
      }
      if (away !== isAwaySharedValue.value) {
        isAwaySharedValue.value = away;
        runOnJS(onAwayFromTopChange)(away);
      }
    },
    [onAwayFromTopChange],
  );

  return displayed;
}
