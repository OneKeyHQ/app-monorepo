import { memo, useCallback, useState } from 'react';

import { RefreshControl } from '@onekeyhq/components';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

export const onHomePageRefresh = () => {
  appEventBus.emit(EAppEventBusNames.AccountDataUpdate, undefined);
};

export interface IPullToRefreshProps {
  onRefresh: () => void;
}

function BasePullToRefresh({ onRefresh, ...props }: IPullToRefreshProps) {
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = useCallback(() => {
    onRefresh?.();
    setRefreshing(true);
    setTimeout(() => {
      setRefreshing(false);
    }, 1200);
  }, [onRefresh]);

  return (
    <RefreshControl
      {...props}
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
