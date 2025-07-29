import { useCallback, useState } from 'react';

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

function PullToNativeRefresh({ onRefresh }: IPullToRefreshProps) {
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

export const PullToRefresh = platformEnv.isNative
  ? PullToNativeRefresh
  : (_props: IPullToRefreshProps) => null;
