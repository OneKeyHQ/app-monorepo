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

import type {
  IFrozenTopHistoryScrollObserverProps,
  IUseFrozenTopHistoryDataResult,
} from './useFrozenTopHistoryData.types';
import type { SharedValue } from 'react-native-reanimated';

// Native fix for OK-57070. See `historyTopFreezeUtils.ts` for the root-cause
// notes. While the user is scrolled away from the top, rows that a background
// refresh prepends are held back so the viewport can't be shifted (no jitter);
// they merge in automatically once the user scrolls back near the top, where
// inserting above is visually safe.
//
// The freeze state machine here is tab-agnostic: it only consumes
// `onAwayFromTopChange` signals. The collapsible-tab scroll tracking lives in
// `FrozenTopHistoryScrollObserver` below, which consumers mount ONLY inside a
// `Tabs.Container` subtree, so the tab-context hook never runs on pages
// without the provider (RecentHistory plain lists, single-token detail view).
// Without an observer mounted, `isAwayFromTop` stays false and the hook is a
// pass-through.
export function useFrozenTopHistoryData(
  combined: IAccountHistoryTx[],
  enabled: boolean,
  identityKey: string,
): IUseFrozenTopHistoryDataResult {
  const [displayed, setDisplayed] = useState<IAccountHistoryTx[]>(combined);
  const displayedRef = useRef(displayed);
  const combinedRef = useRef(combined);
  const isAwayFromTopRef = useRef(false);
  const identityKeyRef = useRef(identityKey);

  const apply = useCallback(() => {
    const next = selectVisibleHistoryRows({
      combined: combinedRef.current,
      displayed: displayedRef.current,
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
    // An identity switch (account / network / all-networks scope / filter
    // toggle) replaces the history stream instead of refreshing it, so the
    // previous displayed-id baseline must stop acting as a freeze anchor: tx
    // ids the new context happens to reuse would otherwise count as "already
    // displayed" and its legitimate top rows would be withheld until the user
    // scrolls back up (`selectVisibleHistoryRows`' wholesale-replacement
    // bail-out only covers streams with zero id overlap). Dropping the away
    // state makes `apply` render the incoming stream live and rebase
    // `displayed` on it. The observer's worklet mirror is intentionally NOT
    // re-synced here: while it stays stale no away=true crossing can fire, so
    // freezing stays off for the new stream until the user returns near the
    // top once — by which point the baseline belongs to the new stream.
    if (identityKeyRef.current !== identityKey) {
      identityKeyRef.current = identityKey;
      isAwayFromTopRef.current = false;
    }
    apply();
  }, [combined, identityKey, apply]);

  // When the gate turns off (list not being viewed) force the live list and
  // clear any stale "away" state so re-focusing always starts unfrozen. The
  // observer clears its worklet-side mirror off the same `enabled` flag.
  useEffect(() => {
    if (!enabled) {
      isAwayFromTopRef.current = false;
      apply();
    }
  }, [enabled, apply]);

  const onAwayFromTopChange = useCallback(
    (away: boolean) => {
      isAwayFromTopRef.current = away;
      apply();
    },
    [apply],
  );

  return { displayedHistoryData: displayed, onAwayFromTopChange };
}

// Headless watcher that reports collapsible-tab scroll threshold crossings to
// `useFrozenTopHistoryData`. It is the only place that touches
// `useCurrentTabScrollY`, so it MUST only be mounted inside a `Tabs.Container`
// subtree — consumers gate it on their tab-scenario flag (`inTabList`,
// `!plainMode && !limit`).
export function FrozenTopHistoryScrollObserver({
  enabled,
  onAwayFromTopChange,
}: IFrozenTopHistoryScrollObserverProps) {
  const scrollY = useCurrentTabScrollY();
  // Worklet-side mirror of the freeze state so the scroll reaction only hops to
  // JS on an actual threshold crossing, not on every scroll frame.
  const isAwaySharedValue = useSharedValue(false);

  // `useCurrentTabScrollY` tracks the FOCUSED tab's scroll position, not this
  // observer's own tab: with several sibling observers mounted (TokenDetails
  // multi-tab), a disabled one would otherwise follow another tab's scrolling
  // and rewrite its own away state. So the reaction below is hard
  // short-circuited while disabled, and on re-enable the state is re-derived
  // once from the scroll offset — which now IS this tab's own — so
  // re-focusing resumes from reality instead of a stale or foreign mirror.
  useEffect(() => {
    if (!enabled) {
      isAwaySharedValue.value = false;
      return;
    }
    const away = (scrollY as SharedValue<number>).value > FREEZE_ENGAGE_OFFSET;
    isAwaySharedValue.value = away;
    onAwayFromTopChange(away);
  }, [enabled, isAwaySharedValue, scrollY, onAwayFromTopChange]);

  useAnimatedReaction(
    () => (scrollY as SharedValue<number>).value,
    (y) => {
      'worklet';

      if (!enabled) {
        return;
      }
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
    [enabled, onAwayFromTopChange],
  );

  return null;
}
