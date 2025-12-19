import { useCallback } from 'react';

import type { IPageNavigationProp } from '@onekeyhq/components';
import { rootNavigationRef, useMedia } from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
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
  const { md } = useMedia();

  const toMarketBannerDetail = useCallback(
    (item: IMarketBannerItem) => {
      defaultLogger.dex.banner.dexBannerEnter({ bannerId: item._id });

      const params = {
        tokenListId: item.tokenListId,
        title: item.title,
      };

      // Mobile or small screen (< md): Open modal
      if (platformEnv.isNative || md) {
        rootNavigationRef.current?.navigate(ERootRoutes.Modal, {
          screen: EModalRoutes.MarketModal,
          params: {
            screen: EModalMarketRoutes.MarketBannerDetail,
            params,
          },
        });
      }
      // Desktop (>= md): Push to page
      else {
        navigation.push(ETabMarketRoutes.MarketBannerDetail, params);
      }
    },
    [navigation, md],
  );

  return toMarketBannerDetail;
}
