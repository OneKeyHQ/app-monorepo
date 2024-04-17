import type { ITabSubNavigatorConfig } from '@onekeyhq/components';
import { ETabHomeRoutes } from '@onekeyhq/shared/src/routes';

import { LazyLoadPage } from '../../../components/LazyLoadPage';
import { UrlAccountLanding, urlAccountLandingRewrite } from '../../Landing';

const HomePageContainer = LazyLoadPage(
  () => import('../pages/HomePageContainer'),
);
export const homeRouters: ITabSubNavigatorConfig<any, any>[] = [
  {
    name: ETabHomeRoutes.TabHome,
    component: HomePageContainer,
    // translationId: 'wallet__wallet',
    rewrite: '/',
    // exact: true,
  },
  {
    name: ETabHomeRoutes.TabHomeUrlAccount,
    component: UrlAccountLanding,
    rewrite: urlAccountLandingRewrite,
    exact: true,
  },
];
