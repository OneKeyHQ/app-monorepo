import { useCallback, useEffect, useRef, useState } from 'react';

import { Haptics, ImpactFeedbackStyle } from '@onekeyhq/components';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { onHomePageRefresh } from '../components/PullToRefresh';

import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';

export function useHomeNativeRefresh() {
  const [refreshing, setRefreshing] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  const onRefresh = useCallback(() => {
    if (timer.current !== undefined) return;
    setRefreshing(true);
    timer.current = setTimeout(() => {
      timer.current = undefined;
      setRefreshing(false);
    }, 1200);
    Haptics.impact(ImpactFeedbackStyle.Medium);
    onHomePageRefresh();
    defaultLogger.account.wallet.walletPullToRefresh();
  }, []);
  const minOverscroll = useRef(0);
  const dragging = useRef(false);
  const onScrollBeginDrag = useCallback(() => {
    dragging.current = true;
    minOverscroll.current = 0;
  }, []);
  const onScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (!dragging.current || !platformEnv.isNativeIOS) return;
      const { contentOffset, contentInset } = event.nativeEvent;
      minOverscroll.current = Math.min(
        minOverscroll.current,
        contentOffset.y + contentInset.top,
      );
    },
    [],
  );
  const onScrollEndDrag = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      onScroll(event);
      dragging.current = false;
      if (platformEnv.isNativeIOS && minOverscroll.current <= -65) onRefresh();
      minOverscroll.current = 0;
    },
    [onRefresh, onScroll],
  );
  return {
    refreshing,
    onRefresh,
    onScrollBeginDrag,
    onScroll,
    onScrollEndDrag,
  };
}
