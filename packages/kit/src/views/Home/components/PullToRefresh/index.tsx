import { memo, useCallback } from 'react';

import { RefreshControl, useTheme } from '@onekeyhq/components';
import type { IRefreshControlType } from '@onekeyhq/components';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

export interface IPullToRefreshProps extends Omit<
  IRefreshControlType,
  'onRefresh' | 'refreshing'
> {
  onRefresh: () => void;
  refreshing?: boolean;
}

function BasePullToRefresh({
  onRefresh,
  refreshing = false,
  ...props
}: IPullToRefreshProps) {
  const theme = useTheme();

  const handleRefresh = useCallback(() => {
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
