import { memo, useCallback, useState } from 'react';

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

export interface IPullToRefreshProps extends Omit<
  IRefreshControlType,
  'onRefresh' | 'refreshing'
> {
  onRefresh: () => void;
}

function BasePullToRefresh({ onRefresh, ...props }: IPullToRefreshProps) {
  const [refreshing, setRefreshing] = useState(false);
  const theme = useTheme();

  const handleRefresh = useCallback(() => {
    onRefresh?.();
    setRefreshing(true);
    setTimeout(() => {
      setRefreshing(false);
    }, 1200);
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
