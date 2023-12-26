import type { IModalFlowNavigatorConfig } from '@onekeyhq/components';

import { NFTDetails } from '../pages';

import { ENFTPages } from './type';

import type { INFTParamList } from './type';

export const NFTRouter: IModalFlowNavigatorConfig<ENFTPages, INFTParamList>[] =
  [
    {
      name: ENFTPages.NFTDetails,
      component: NFTDetails,
    },
  ];
