import { useCallback } from 'react';

import type { IPageNavigationProp } from '@onekeyhq/components';
import { rootNavigationRef } from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import {
  EModalRoutes,
  ERootRoutes,
  ETabMarketRoutes,
  type ITabMarketParamList,
} from '@onekeyhq/shared/src/routes';
import type { IMarketBannerItem } from '@onekeyhq/shared/types/marketV2';

import { EModalMarketRoutes } from '../../../router';

export function useToMarketBannerDetail() {
  const navigation =
    useAppNavigation<IPageNavigationProp<ITabMarketParamList>>();

  const toMarketBannerDetail = useCallback(
    (item: IMarketBannerItem) => {
      const params = {
        tokenListId: item.tokenListId,
        title: item.title,
      };

      // Mobile: Open modal
      if (platformEnv.isNative) {
        rootNavigationRef.current?.navigate(ERootRoutes.Modal, {
          screen: EModalRoutes.MarketModal,
          params: {
            screen: EModalMarketRoutes.MarketBannerDetail,
            params,
          },
        });
      }
      // Desktop: Push to page
      else {
        navigation.push(ETabMarketRoutes.MarketBannerDetail, params);
      }
    },
    [navigation],
  );

  return toMarketBannerDetail;
}
