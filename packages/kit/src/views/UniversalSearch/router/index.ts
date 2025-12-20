import type { IModalFlowNavigatorConfig } from '@onekeyhq/components';
import type { ITestModalPagesParam } from '@onekeyhq/shared/src/routes';
import { EUniversalSearchPages } from '@onekeyhq/shared/src/routes/universalSearch';

import { LazyLoadPage } from '../../../components/LazyLoadPage';

const UniversalSearchPage = LazyLoadPage(
  () => import('../pages/UniversalSearch'),
);

const MarketDetail = LazyLoadPage(
  () => import('@onekeyhq/kit/src/views/Market/MarketDetail'),
);

export const UniversalSearchRouter: IModalFlowNavigatorConfig<
  EUniversalSearchPages,
  ITestModalPagesParam
>[] = [
  {
    name: EUniversalSearchPages.UniversalSearch,
    component: UniversalSearchPage,
  },
  {
    name: EUniversalSearchPages.MarketDetail,
    component: MarketDetail,
  },
];
