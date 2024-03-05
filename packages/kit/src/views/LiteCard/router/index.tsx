import type { IModalFlowNavigatorConfig } from '@onekeyhq/components/src/layouts/Navigation/Navigator';
import LazyLoad from '@onekeyhq/shared/src/lazyLoad';

import { ELiteCardRoutes } from './types';

import type { ILiteCardParamList } from './types';

const LiteCardHome = LazyLoad(
  () => import('@onekeyhq/kit/src/views/LiteCard/pages/Home'),
);

const LiteCardSelectWallet = LazyLoad(
  () => import('@onekeyhq/kit/src/views/LiteCard/pages/SelectWallet'),
);

export const LiteCardPages: IModalFlowNavigatorConfig<
  ELiteCardRoutes,
  ILiteCardParamList
>[] = [
  {
    name: ELiteCardRoutes.LiteCardHome,
    component: LiteCardHome,
    translationId: 'app__hardware_name_onekey_lite',
  },
  {
    name: ELiteCardRoutes.LiteCardSelectWallet,
    component: LiteCardSelectWallet,
    translationId: 'title_select_wallet',
  },
];
