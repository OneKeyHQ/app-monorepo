import { createContext } from 'react';

import type { useTokenDetailInfo, useTokenPositionInfo } from '../../hooks';
import type { HomeRoutes } from '../../routes/routesEnum';
import type { HomeRoutesParams } from '../../routes/types';

export const TokenDetailContext = createContext<
  | {
      routeParams: HomeRoutesParams[HomeRoutes.ScreenTokenDetail];
      positionInfo: ReturnType<typeof useTokenPositionInfo>;
      detailInfo: ReturnType<typeof useTokenDetailInfo>;
    }
  | undefined
>(undefined);
