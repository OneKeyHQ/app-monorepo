import type { IModalFlowNavigatorConfig } from '@onekeyhq/components';
import type { IPrimeParamList } from '@onekeyhq/shared/src/routes/prime';
import { EPrimePages } from '@onekeyhq/shared/src/routes/prime';

import { LazyLoadPage } from '../../../components/LazyLoadPage';

const PrimeDashboard = LazyLoadPage(() => import('../pages/PrimeDashboard'));
const PrimeDeviceLimit = LazyLoadPage(
  () => import('../pages/PrimeDeviceLimit'),
);

export const PrimeRouter: IModalFlowNavigatorConfig<
  EPrimePages,
  IPrimeParamList
>[] = [
  {
    name: EPrimePages.PrimeDashboard,
    component: PrimeDashboard,
  },
  {
    name: EPrimePages.PrimeDeviceLimit,
    component: PrimeDeviceLimit,
  },
];
