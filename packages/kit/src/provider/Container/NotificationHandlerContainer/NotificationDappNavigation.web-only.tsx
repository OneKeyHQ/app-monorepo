import { useCallback } from 'react';
import type { ReactNode } from 'react';

import { openUrlExternal } from '@onekeyhq/shared/src/utils/openUrlUtils';

import type useAppNavigation from '../../../hooks/useAppNavigation';

type IAppNavigation = ReturnType<typeof useAppNavigation>;

export function useNotificationDappNavigation(_navigation: IAppNavigation) {
  return useCallback((url: string) => {
    openUrlExternal(url);
  }, []);
}

export function NotificationHandlerDiscoveryProvider({
  children,
}: {
  children: ReactNode;
}) {
  return <>{children}</>;
}
