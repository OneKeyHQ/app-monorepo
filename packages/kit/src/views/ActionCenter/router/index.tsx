import type { IModalFlowNavigatorConfig } from '@onekeyhq/components';
import { LazyLoadPage } from '@onekeyhq/kit/src/components/LazyLoadPage';
import type { IActionCenterParamList } from '@onekeyhq/shared/src/routes/fullScreenPush';
import { EActionCenterPages } from '@onekeyhq/shared/src/routes/fullScreenPush';

const ActionCenter = LazyLoadPage(() => import('../pages/ActionCenter'));

const hiddenHeaderOptions = {
  headerShown: false,
};

export const ActionCenterRouter: IModalFlowNavigatorConfig<
  EActionCenterPages,
  IActionCenterParamList
>[] = [
  {
    name: EActionCenterPages.ActionCenter,
    component: ActionCenter,
    options: hiddenHeaderOptions,
  },
];
