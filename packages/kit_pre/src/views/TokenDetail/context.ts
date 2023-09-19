import { createContext } from 'react';

import type { HomeRoutes } from '../../routes/routesEnum';
import type { HomeRoutesParams } from '../../routes/types';
import type { ITokenDetailInfo } from '../ManageTokens/types';
import type { IOverviewTokenDetailListItem } from '../Overview/types';
import type B from 'bignumber.js';

export type ITokenDetailContext = {
  isLoading?: boolean;
  balance?: B;
  items: IOverviewTokenDetailListItem[];
  detailInfo: ITokenDetailInfo;
  routeParams: HomeRoutesParams[HomeRoutes.ScreenTokenDetail];
};

export const TokenDetailContext = createContext<
  ITokenDetailContext | undefined
>(undefined);
