import type { IModalFlowNavigatorConfig } from '@onekeyhq/components';
import { LazyLoadPage } from '@onekeyhq/kit/src/components/LazyLoadPage';
import type { IOnboardingParamListV2 } from '@onekeyhq/shared/src/routes';
import { EOnboardingPagesV2 } from '@onekeyhq/shared/src/routes';

const GetStarted = LazyLoadPage(() => import('../pages/GetStarted'));

export const OnboardingRouterV2: IModalFlowNavigatorConfig<
  EOnboardingPages,
  IOnboardingParamListV2
>[] = [
  {
    name: EOnboardingPagesV2.GetStarted,
    component: GetStarted,
  },
];
