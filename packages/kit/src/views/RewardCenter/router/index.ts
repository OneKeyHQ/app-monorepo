import type { IModalFlowNavigatorConfig } from '@onekeyhq/components';
import type { IModalRewardCenterParamList } from '@onekeyhq/shared/src/routes';
import { EModalRewardCenterRoutes } from '@onekeyhq/shared/src/routes';
import {
  bindRouteManifest,
  rewardCenterRouteManifest,
} from '@onekeyhq/shared/src/routes/routeManifest';

import { LazyLoadPage } from '../../../components/LazyLoadPage';

const RewardCenterModal = LazyLoadPage(() => import('../pages/RewardCenter'));

const rewardCenterRouteBindings: IModalFlowNavigatorConfig<
  EModalRewardCenterRoutes,
  IModalRewardCenterParamList
>[] = [
  {
    name: EModalRewardCenterRoutes.RewardCenter,
    component: RewardCenterModal,
  },
];

export const RewardCenterStack = bindRouteManifest(
  rewardCenterRouteManifest,
  rewardCenterRouteBindings,
);
