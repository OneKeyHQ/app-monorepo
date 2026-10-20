import { useCallback } from 'react';

import { findFocusedRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import { Toast, rootNavigationRef, useMedia } from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { usePerpTabConfig } from '@onekeyhq/kit/src/hooks/usePerpTabConfig';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import type { EPerpPageEnterSource } from '@onekeyhq/shared/src/logger/scopes/perp/perpPageSource';
import { generateUUID } from '@onekeyhq/shared/src/utils/miscUtils';

import { EModalMarketRoutes } from '../router/types';

let latestPerpsNavigationRequestId: string | undefined;

export function usePerpsNavigation(source?: EPerpPageEnterSource) {
  const intl = useIntl();
  const navigation = useAppNavigation();
  const { gtMd } = useMedia();
  const { perpDisabled, perpTabShowWeb } = usePerpTabConfig();

  const navigateToPerps = useCallback(
    (coin: string) => {
      if (!coin.trim() || perpDisabled) return;
      const requestId = generateUUID();
      latestPerpsNavigationRequestId = requestId;
      const entryRoute = rootNavigationRef.current?.getCurrentRoute();
      const entryState =
        entryRoute?.name === EModalMarketRoutes.MobileTokenSelector
          ? rootNavigationRef.current?.getRootState()
          : undefined;
      const routeBelowSelector = entryState?.routes[entryState.index - 1];
      const entryRouteKey = routeBelowSelector?.state
        ? findFocusedRoute(routeBelowSelector.state)?.key
        : (routeBelowSelector?.key ?? entryRoute?.key);
      if (
        entryRoute?.name === EModalMarketRoutes.MobileTokenSelector &&
        entryRouteKey === entryRoute.key
      )
        return;
      const isCurrentRequest = () =>
        latestPerpsNavigationRequestId === requestId;
      const isCurrentNavigation = () =>
        isCurrentRequest() &&
        (!entryRouteKey ||
          rootNavigationRef.current?.getCurrentRoute()?.key === entryRouteKey);
      setTimeout(async () => {
        try {
          const { navigateToPerps: navigate } =
            await import('../utils/perpsNavigation');
          await navigate({
            coin,
            requestId,
            entryRouteKey,
            closingSelectorKey:
              entryRoute?.name === EModalMarketRoutes.MobileTokenSelector
                ? entryRoute.key
                : undefined,
            isCurrentRequest,
            isCurrentNavigation,
            navigation,
            source,
            perpTabShowWeb,
            gtMd,
            intl,
          });
        } catch (error) {
          if (!isCurrentNavigation()) return;
          Toast.error({
            title: intl.formatMessage({
              id: ETranslations.global_unknown_error_retry_message,
            }),
          });
          defaultLogger.app.error.log(
            `Failed to load Perps navigation: ${String(error)}`,
          );
        }
      }, 80);
    },
    [intl, navigation, source, perpDisabled, perpTabShowWeb, gtMd],
  );

  return { navigateToPerps };
}
