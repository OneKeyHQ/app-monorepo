import { memo, useCallback, useRef, useState } from 'react';

import { RefreshControl, useTheme } from '@onekeyhq/components';
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

export interface IPullToRefreshProps extends Omit<
  IRefreshControlType,
  'onRefresh' | 'refreshing'
> {
  onRefresh: () => void;
}

function BasePullToRefresh({ onRefresh, ...props }: IPullToRefreshProps) {
  const [refreshing, setRefreshing] = useState(false);
  const refreshingRef = useRef(false);
  const theme = useTheme();

  const handleRefresh = useCallback(() => {
    // Keep repeated native refresh events within one refresh cycle.
    if (refreshingRef.current) {
      return;
    }
    refreshingRef.current = true;
    setRefreshing(true);
    // Arm the reset before invoking onRefresh so a synchronous throw cannot
    // leave the guard stuck and silently disable every later pull.
    setTimeout(() => {
      refreshingRef.current = false;
      setRefreshing(false);
    }, REFRESHING_INDICATOR_DURATION_MS);
    onRefresh?.();
    defaultLogger.account.wallet.walletPullToRefresh();
  }, [onRefresh]);

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
