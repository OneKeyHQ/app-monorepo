import type { IModalFlowNavigatorConfig } from '@onekeyhq/components';

import { LowValueTokens, TokenDetails } from '../pages';

import { ETokenPages } from './type';

import type { ITokenParamList } from './type';

export const TokenRouter: IModalFlowNavigatorConfig<
  ETokenPages,
  ITokenParamList
>[] = [
  {
    name: ETokenPages.TokenDetails,
    component: TokenDetails,
  },
  {
    name: ETokenPages.LowValueTokens,
    component: LowValueTokens,
  },
];
