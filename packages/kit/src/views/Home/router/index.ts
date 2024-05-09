import type { ITabSubNavigatorConfig } from '@onekeyhq/components';
import { ETabHomeRoutes } from '@onekeyhq/shared/src/routes';

import { LazyLoadPage } from '../../../components/LazyLoadPage';
import { urlAccountLandingRewrite } from '../pages/urlAccount/urlAccountUtils';

const HomePageContainer = LazyLoadPage(
  () => import('../pages/HomePageContainer'),
);

const UrlAccountPageContainer = LazyLoadPage(async () => {
  const { UrlAccountPageContainer: UrlAccountPageContainerModule } =
    await import('../pages/urlAccount/UrlAccountPage');
  return { default: UrlAccountPageContainerModule };
});

const UrlAccountLanding = LazyLoadPage(async () => {
  const { UrlAccountLanding: UrlAccountLandingModule } = await import(
    '../pages/urlAccount/UrlAccountPage'
  );
  return { default: UrlAccountLandingModule };
});

export const homeRouters: ITabSubNavigatorConfig<any, any>[] = [
  {
    name: ETabHomeRoutes.TabHome,
    component: HomePageContainer,
    // translationId: 'wallet__wallet',
    rewrite: '/',
    // exact: true,
  },
  {
    name: ETabHomeRoutes.TabHomeUrlAccountLanding,
    component: UrlAccountLanding,
    rewrite: urlAccountLandingRewrite,
    exact: true,
  },
  {
    name: ETabHomeRoutes.TabHomeUrlAccountPage,
    component: UrlAccountPageContainer,
    // rewrite: urlAccountPageRewrite,
    exact: true,
  },
];
