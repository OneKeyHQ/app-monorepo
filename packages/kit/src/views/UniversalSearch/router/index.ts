import type { IModalFlowNavigatorConfig } from '@onekeyhq/components';
import type { ITestModalPagesParam } from '@onekeyhq/shared/src/routes';
import { EUniversalSearchPages } from '@onekeyhq/shared/src/routes/universalSearch';

import { LazyLoadPage } from '../../../components/LazyLoadPage';

const UniversalSearchPage = LazyLoadPage(
  () => import('../pages/UniversalSearch'),
);

export const UniversalSearchRouter: IModalFlowNavigatorConfig<
  EUniversalSearchPages,
  ITestModalPagesParam
>[] = [
  {
    name: EUniversalSearchPages.UniversalSearch,
    component: UniversalSearchPage,
  },
];
