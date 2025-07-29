import { memo, useCallback, useState } from 'react';

import { RefreshControl } from '@onekeyhq/components';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

export const onHomePageRefresh = () => {
  appEventBus.emit(EAppEventBusNames.AccountDataUpdate, undefined);
  console.log('onHomePageRefresh');
};

export interface IPullToRefreshProps {
  onRefresh: () => void;
}

function BasePullToRefresh({ onRefresh }: IPullToRefreshProps) {
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = useCallback(() => {
    onRefresh?.();
    setRefreshing(true);
    setTimeout(() => {
      setRefreshing(false);
    }, 1200);
  }, [onRefresh]);

  return <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />;
}

const MemoPullToRefresh = memo(BasePullToRefresh);
const EmptyPullToRefresh = (_props: IPullToRefreshProps) => null;

export const PullToRefreshOnIOS = platformEnv.isNativeIOS
  ? MemoPullToRefresh
  : EmptyPullToRefresh;

export const PullToRefreshOnAndroid = platformEnv.isNativeAndroid
  ? MemoPullToRefresh
  : EmptyPullToRefresh;
