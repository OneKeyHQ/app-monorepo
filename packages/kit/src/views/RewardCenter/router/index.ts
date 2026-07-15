import type { IModalFlowNavigatorConfig } from '@onekeyhq/components';
import type { IModalRewardCenterParamList } from '@onekeyhq/shared/src/routes';
import { EModalRewardCenterRoutes } from '@onekeyhq/shared/src/routes';

import { LazyLoadPage } from '../../../components/LazyLoadPage';

const RewardCenterModal = LazyLoadPage(() => import('../pages/RewardCenter'));

export const RewardCenterStack: IModalFlowNavigatorConfig<
  EModalRewardCenterRoutes,
  IModalRewardCenterParamList
>[] = [
  {
    name: EModalRewardCenterRoutes.RewardCenter,
    component: RewardCenterModal,
    rewrite: '/reward-center',
    exact: true,
  },
];
