import { useCallback } from 'react';

import type { IPageNavigationProp } from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import {
  ETabMarketRoutes,
  type ITabMarketParamList,
} from '@onekeyhq/shared/src/routes';
import type { IMarketBannerItem } from '@onekeyhq/shared/types/marketV2';

export function useToMarketBannerDetail() {
  const navigation =
    useAppNavigation<IPageNavigationProp<ITabMarketParamList>>();

  const toMarketBannerDetail = useCallback(
    (item: IMarketBannerItem) => {
      defaultLogger.dex.banner.dexBannerEnter({ bannerId: item._id });

      const params = {
        tokenListId: item.tokenListId,
        title: item.title,
      };

      // Push to page (works on all platforms including native via Discovery routes)
      navigation.push(ETabMarketRoutes.MarketBannerDetail, params);
    },
    [navigation],
  );

  return toMarketBannerDetail;
}
