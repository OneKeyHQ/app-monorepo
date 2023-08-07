import { createContext } from 'react';

import type { useTokenDetailInfo } from '../../hooks';
import type { HomeRoutes } from '../../routes/routesEnum';
import type { HomeRoutesParams } from '../../routes/types';

export const TokenDetailContext = createContext<
  | {
      routeParams: HomeRoutesParams[HomeRoutes.ScreenTokenDetail];
      detailInfo: ReturnType<typeof useTokenDetailInfo>;
    }
  | undefined
>(undefined);
