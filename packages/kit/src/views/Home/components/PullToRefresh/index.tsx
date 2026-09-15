import { memo, useCallback, useContext, useRef, useState } from 'react';

import {
  runOnJS,
  useAnimatedReaction,
  useSharedValue,
} from 'react-native-reanimated';

import {
  CollapsibleTabContext,
  CollapsibleTabNameContext,
  Haptics,
  ImpactFeedbackStyle,
  RefreshControl,
  useTheme,
} from '@onekeyhq/components';
import type { IRefreshControlType } from '@onekeyhq/components';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

export const onHomePageRefresh = () => {
  appEventBus.emit(EAppEventBusNames.AccountDataUpdate, {
    isManualRefresh: true,
    refreshSource: 'pull-to-refresh',
  });
};

const REFRESHING_INDICATOR_DURATION_MS = 1200;

// Overscroll (in points, measured on the list's contentOffset) after which a
// released pull counts as a refresh on iOS. UIRefreshControl only fires at
// roughly 100-115pt of overscroll, and iOS rubber-banding turns a finger
// travel into much less offset, so a list whose first row sits low on the
// screen (tall collapsible header: alerts + banner) can never reach it before
// the finger hits the screen edge (OK-63207). 65pt keeps the gesture
// deliberate (~130pt of finger travel) while staying reachable there.
export const IOS_LIST_PULL_TO_REFRESH_OVERSCROLL_THRESHOLD = 65;

export interface IPullToRefreshProps extends Omit<
  IRefreshControlType,
  'onRefresh' | 'refreshing'
> {
  onRefresh: () => void;
}

// Fires `onTrigger` when a drag on the focused collapsible tab list ends with
// its deepest overscroll beyond the threshold. Reads the drag state and
// scroll offset the patched react-native-collapsible-tab-view container
// exposes; outside a Tabs.Container both are undefined and the hook is inert.
function useIosListPullToRefreshFallback({
  enabled,
  onTrigger,
}: {
  enabled: boolean;
  onTrigger: () => void;
}) {
  const tabsContext = useContext(CollapsibleTabContext);
  const tabName = useContext(CollapsibleTabNameContext);
  const scrollYCurrent = tabsContext?.scrollYCurrent;
  const isScrollDragging = tabsContext?.isScrollDragging;
  const focusedTab = tabsContext?.focusedTab;
  const minOverscrollY = useSharedValue(0);

  useAnimatedReaction(
    () => {
      if (!enabled || !scrollYCurrent || !isScrollDragging || !focusedTab) {
        return undefined;
      }
      return {
        dragging: isScrollDragging.value,
        y: scrollYCurrent.value,
        focused: focusedTab.value === tabName,
      };
    },
    (current, previous) => {
      if (!current || !current.focused) {
        minOverscrollY.value = 0;
        return;
      }
      if (current.dragging) {
        if (!previous?.dragging) {
          minOverscrollY.value = 0;
        }
        if (current.y < minOverscrollY.value) {
          minOverscrollY.value = current.y;
        }
        return;
      }
      if (previous?.dragging) {
        const reached =
          minOverscrollY.value <=
          -IOS_LIST_PULL_TO_REFRESH_OVERSCROLL_THRESHOLD;
        minOverscrollY.value = 0;
        if (reached) {
          runOnJS(onTrigger)();
        }
      }
    },
    [enabled, scrollYCurrent, isScrollDragging, focusedTab, tabName, onTrigger],
  );
}

function BasePullToRefresh({ onRefresh, ...props }: IPullToRefreshProps) {
  const [refreshing, setRefreshing] = useState(false);
  const refreshingRef = useRef(false);
  const theme = useTheme();

  const handleRefresh = useCallback(() => {
    // The native control and the iOS overscroll fallback can both observe
    // the same pull; whichever fires first owns this refresh cycle.
    if (refreshingRef.current) {
      return;
    }
    refreshingRef.current = true;
    onRefresh?.();
    setRefreshing(true);
    setTimeout(() => {
      refreshingRef.current = false;
      setRefreshing(false);
    }, REFRESHING_INDICATOR_DURATION_MS);
    defaultLogger.account.wallet.walletPullToRefresh();
  }, [onRefresh]);

  const handleFallbackRefresh = useCallback(() => {
    if (refreshingRef.current) {
      return;
    }
    // Mirrors the haptic the RefreshControl wrapper plays on native trigger.
    Haptics.impact(ImpactFeedbackStyle.Medium);
    handleRefresh();
  }, [handleRefresh]);

  useIosListPullToRefreshFallback({
    enabled: !!platformEnv.isNativeIOS,
    onTrigger: handleFallbackRefresh,
  });

  const iosRefreshControlProps: Partial<IRefreshControlType> =
    platformEnv.isNativeIOS
      ? { tintColor: props.tintColor ?? theme.iconSubdued.val }
      : {};

  return (
    <RefreshControl
      {...props}
      {...iosRefreshControlProps}
      refreshing={refreshing}
      onRefresh={handleRefresh}
    />
  );
}

const MemoPullToRefresh = memo(BasePullToRefresh);
const EmptyPullToRefresh = (_props: IPullToRefreshProps) => null;

export const PullToRefresh = platformEnv.isNative
  ? MemoPullToRefresh
  : EmptyPullToRefresh;
