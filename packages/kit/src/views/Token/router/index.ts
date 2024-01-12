import type { IModalFlowNavigatorConfig } from '@onekeyhq/components';

import {
  History,
  NFTDetails,
  Receive,
  Send,
  TokenDetails,
  TokenListWithProvider,
} from '../pages';

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
    name: ETokenPages.TokenList,
    component: TokenListWithProvider,
  },
  {
    name: ETokenPages.NFTDetails,
    component: NFTDetails,
  },
  {
    name: ETokenPages.Receive,
    component: Receive,
  },
  {
    name: ETokenPages.History,
    component: History,
  },
  {
    name: ETokenPages.Send,
    component: Send,
  },
];
