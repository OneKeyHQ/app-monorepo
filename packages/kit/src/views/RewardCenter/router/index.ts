import type { IModalFlowNavigatorConfig } from '@onekeyhq/components';
import type { IModalRewardCenterParamList } from '@onekeyhq/shared/src/routes';
import { EModalRewardCenterRoutes } from '@onekeyhq/shared/src/routes';

import { LazyLoadPage } from '../../../components/LazyLoadPage';

const SubsidyCenterModal = LazyLoadPage(
  () => import('../pages/SubsidyCenter/SubsidyCenter'),
);

const SubsidyHistoryModal = LazyLoadPage(
  () => import('../pages/SubsidyCenter/SubsidyHistory'),
);

const subsidyModalSize = {
  modalContentMaxWidth: 800,
  modalContentMaxHeight: 520,
};

export const RewardCenterStack: IModalFlowNavigatorConfig<
  EModalRewardCenterRoutes,
  IModalRewardCenterParamList
>[] = [
  {
    name: EModalRewardCenterRoutes.RewardCenter,
    component: SubsidyCenterModal,
    rewrite: '/reward-center',
    exact: true,
    ...subsidyModalSize,
  },
  {
    name: EModalRewardCenterRoutes.SubsidyHistory,
    component: SubsidyHistoryModal,
    ...subsidyModalSize,
  },
];
