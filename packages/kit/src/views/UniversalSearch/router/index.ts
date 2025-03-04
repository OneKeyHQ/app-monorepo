import type { IModalFlowNavigatorConfig } from '@onekeyhq/components';
import { EUniversalSearchPages } from '@onekeyhq/shared/src/routes/universalSearch';
import type { IUniversalSearchParamList } from '@onekeyhq/shared/src/routes/universalSearch';

import { LazyLoadPage } from '../../../components/LazyLoadPage';

const UniversalSearchPage = LazyLoadPage(
  () => import('../pages/UniversalSearch'),
);

export const UniversalSearchRouter: IModalFlowNavigatorConfig<
  EUniversalSearchPages,
  IUniversalSearchParamList
>[] = [
  {
    name: EUniversalSearchPages.UniversalSearch,
    component: UniversalSearchPage,
  },
];
