import { createContext } from 'react';

import type { Token } from '@onekeyhq/engine/src/types/token';

import type { HomeRoutes } from '../../routes/routesEnum';
import type { HomeRoutesParams } from '../../routes/types';
import type { ITokenDetailInfo } from '../ManageTokens/types';

export const TokenDetailContext = createContext<
  | {
      routeParams: HomeRoutesParams[HomeRoutes.ScreenTokenDetail];
      detailInfo: ITokenDetailInfo & {
        defaultToken?: Token;
      };
    }
  | undefined
>(undefined);
