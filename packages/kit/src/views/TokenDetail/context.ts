import { createContext } from 'react';

import type { useTokenPositionInfo } from '../../hooks';
import type { HomeRoutes } from '../../routes/routesEnum';
import type { HomeRoutesParams } from '../../routes/types';

export const TokenDetailContext = createContext<
  | {
      routeParams: HomeRoutesParams[HomeRoutes.ScreenTokenDetail];
      detailInfo: ReturnType<typeof useTokenPositionInfo>;
    }
  | undefined
>(undefined);
