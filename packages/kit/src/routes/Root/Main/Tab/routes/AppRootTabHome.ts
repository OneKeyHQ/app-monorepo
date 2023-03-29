import { withTabLayout } from '@onekeyhq/components/src/Layout/withTabLayout';

import { toFocusedLazy } from '../../../../../components/LazyRenderWhenFocus';
import BulkSender from '../../../../../views/BulkSender';
import FullTokenList from '../../../../../views/FullTokenList/FullTokenList';
import NFTMarketCollectionScreen from '../../../../../views/NFTMarket/CollectionDetail';
import PNLDetailScreen from '../../../../../views/NFTMarket/PNL/PNLDetail';
import OverviewDefiListScreen from '../../../../../views/Overview';
import RevokePage from '../../../../../views/Revoke';
import RevokeRedirectPage from '../../../../../views/Revoke/Redirect';
import TokenDetail from '../../../../../views/TokenDetail';
import HomeScreen from '../../../../../views/Wallet';
import { HomeRoutes, TabRoutes } from '../../../../routesEnum';

import { tabRoutesConfigBaseMap } from './tabRoutes.base';

import type { TabRouteConfig } from '../../../../types';

const name = TabRoutes.Home;
const config: TabRouteConfig = {
  ...tabRoutesConfigBaseMap[name],
  // eslint-disable-next-line @typescript-eslint/no-unsafe-call
  component: toFocusedLazy(withTabLayout(HomeScreen, name), {
    rootTabName: name,
  }),
  children: [
    {
      name: HomeRoutes.ScreenTokenDetail,
      component: TokenDetail,
      alwaysShowBackButton: true,
    },
    {
      name: HomeRoutes.FullTokenListScreen,
      component: FullTokenList,
      i18nTitle: 'asset__tokens',
    },
    {
      name: HomeRoutes.Revoke,
      component: RevokePage,
      alwaysShowBackButton: true,
    },
    {
      name: HomeRoutes.RevokeRedirect,
      component: RevokeRedirectPage,
    },
    {
      name: HomeRoutes.RevokeRedirect2,
      component: RevokeRedirectPage,
    },
    {
      name: HomeRoutes.NFTMarketCollectionScreen,
      component: NFTMarketCollectionScreen,
    },
    {
      name: HomeRoutes.NFTPNLScreen,
      component: PNLDetailScreen,
      alwaysShowBackButton: true,
      i18nTitle: 'action__profit_and_loss',
    },
    {
      name: HomeRoutes.OverviewDefiListScreen,
      component: OverviewDefiListScreen,
    },
    {
      name: HomeRoutes.BulkSender,
      component: BulkSender,
      alwaysShowBackButton: true,
    },
  ],
};
export default config;
