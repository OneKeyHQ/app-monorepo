import type { IModalFlowNavigatorConfig } from '@onekeyhq/components';
import type { IModalAssetListParamList } from '@onekeyhq/shared/src/routes';
import { EModalAssetListRoutes } from '@onekeyhq/shared/src/routes';

import { TokenListWithProvider } from '../pages/TokenList';

export const ModalAssetListStack: IModalFlowNavigatorConfig<
  EModalAssetListRoutes,
  IModalAssetListParamList
>[] = [
  {
    name: EModalAssetListRoutes.TokenList,
    component: TokenListWithProvider,
  },
];
