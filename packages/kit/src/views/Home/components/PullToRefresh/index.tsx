import {
  createContext,
  memo,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';
import type { PropsWithChildren } from 'react';

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

const HomePullToRefreshOffsetContext = createContext<number | undefined>(
  undefined,
);

export function HomePullToRefreshProvider({
  children,
  progressViewOffset,
}: PropsWithChildren<{ progressViewOffset?: number }>) {
  const value = useMemo(() => progressViewOffset, [progressViewOffset]);

  return (
    <HomePullToRefreshOffsetContext.Provider value={value}>
      {children}
    </HomePullToRefreshOffsetContext.Provider>
  );
}

export interface IPullToRefreshProps extends Omit<
  IRefreshControlType,
  'onRefresh' | 'refreshing'
> {
  onRefresh: () => void;
}

function BasePullToRefresh({ onRefresh, ...props }: IPullToRefreshProps) {
  const [refreshing, setRefreshing] = useState(false);
  const theme = useTheme();
  const progressViewOffsetFromContext = useContext(
    HomePullToRefreshOffsetContext,
  );
  const shouldUseContextProgressViewOffset =
    platformEnv.isNativeIOS &&
    (props.progressViewOffset === undefined ||
      props.progressViewOffset === 0) &&
    progressViewOffsetFromContext !== undefined;

  const handleRefresh = useCallback(() => {
    onRefresh?.();
    setRefreshing(true);
    setTimeout(() => {
      setRefreshing(false);
    }, 1200);
    defaultLogger.account.wallet.walletPullToRefresh();
  }, [onRefresh]);

  // Keep the idle offset at zero because iOS also counts progressViewOffset
  // toward the native pull distance required to trigger UIRefreshControl.
  const progressViewOffset =
    shouldUseContextProgressViewOffset && refreshing
      ? progressViewOffsetFromContext
      : props.progressViewOffset;
  const iosRefreshControlProps: Partial<IRefreshControlType> =
    platformEnv.isNativeIOS
      ? { tintColor: props.tintColor ?? theme.iconSubdued.val }
      : {};

  return (
    <RefreshControl
      {...props}
      {...iosRefreshControlProps}
      progressViewOffset={progressViewOffset}
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
