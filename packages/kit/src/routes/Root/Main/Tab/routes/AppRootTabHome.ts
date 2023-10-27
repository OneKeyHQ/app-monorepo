import { withTabLayout } from '@onekeyhq/components/src/Layout/withTabLayout';

import { toFocusedLazy } from '../../../../../components/LazyRenderWhenFocus';
import BulkSender from '../../../../../views/BulkSender';
import FullTokenList from '../../../../../views/FullTokenList/FullTokenList';
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
  component: withTabLayout(
    toFocusedLazy(HomeScreen, {
      rootTabName: name,
    }),
    name,
  ),
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
      name: HomeRoutes.NFTPNLScreen,
      component: PNLDetailScreen,
      alwaysShowBackButton: true,
    },
    {
      name: HomeRoutes.OverviewDefiListScreen,
      component: OverviewDefiListScreen,
    },
    {
      name: HomeRoutes.BulkSender,
      component: BulkSender,
    },
  ],
};
export default config;
