import type { IModalFlowNavigatorConfig } from '@onekeyhq/components';
import type { ITestModalPagesParam } from '@onekeyhq/shared/src/routes';
import { EUniversalSearchPages } from '@onekeyhq/shared/src/routes/universalSearch';

import { LazyLoadPage } from '../../../components/LazyLoadPage';
import { TOKEN_SELECTOR_POPOVER_WIDTH } from '../../Market/MarketDetailV2/components/TokenSelector/constants';

const UniversalSearchPage = LazyLoadPage(
  () => import('../pages/UniversalSearch'),
);

const MarketDetail = LazyLoadPage(
  () => import('@onekeyhq/kit/src/views/Market/LegacyMarketDetailRoute'),
);

export const UniversalSearchRouter: IModalFlowNavigatorConfig<
  EUniversalSearchPages,
  ITestModalPagesParam
>[] = [
  {
    name: EUniversalSearchPages.UniversalSearch,
    component: UniversalSearchPage,
    // Stock and token results use the Market detail selector's tables, laid
    // out for its width. The page narrows it back for a dApp-only search.
    modalContentMaxWidth: TOKEN_SELECTOR_POPOVER_WIDTH,
  },
  {
    name: EUniversalSearchPages.MarketDetail,
    component: MarketDetail,
  },
];
