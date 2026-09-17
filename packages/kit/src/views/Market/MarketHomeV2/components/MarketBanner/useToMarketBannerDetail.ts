import { useCallback } from 'react';

import {
  type IPageNavigationProp,
  useSplitMainView,
} from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import {
  EModalRoutes,
  ETabMarketRoutes,
  type ITabMarketParamList,
} from '@onekeyhq/shared/src/routes';
import type { IMarketBannerItem } from '@onekeyhq/shared/types/marketV2';

import { EModalMarketRoutes } from '../../../router/types';
import { isMarketIndexQuoteBanner } from '../../../utils/marketBannerUtils';

export function useToMarketBannerDetail() {
  const navigation =
    useAppNavigation<IPageNavigationProp<ITabMarketParamList>>();
  const isTabletMainView = useSplitMainView();

  const toMarketBannerDetail = useCallback(
    (item: IMarketBannerItem) => {
      if (isMarketIndexQuoteBanner(item)) return;
      defaultLogger.dex.banner.dexBannerEnter({ bannerId: item._id, ...item });

      const params = {
        tokenListId: item.tokenListId,
        title: item.title,
        type: item.type,
        assetType: item.assetType,
      };

      if (isTabletMainView) {
        // The detail pane has its own root navigator. Use the modal route so
        // the relayed navigation reaches the registered Market stack instead
        // of trying to push a Discovery child route on the root navigator.
        navigation.pushModal(EModalRoutes.MarketModal, {
          screen: EModalMarketRoutes.MarketBannerDetail,
          params,
        });
      } else {
        navigation.push(ETabMarketRoutes.MarketBannerDetail, params);
      }
    },
    [isTabletMainView, navigation],
  );

  return toMarketBannerDetail;
}
