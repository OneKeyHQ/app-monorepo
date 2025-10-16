import { memo, useCallback, useState } from 'react';

import { RefreshControl } from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';

export interface IPullToRefreshProps {
  onRefresh: () => Promise<void>;
}

function BasePullToRefresh({ onRefresh, ...props }: IPullToRefreshProps) {
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([onRefresh?.(), timerUtils.wait(1200)]);
    } finally {
      setRefreshing(false);
    }
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
