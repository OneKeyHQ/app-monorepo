import type { ITabSubNavigatorConfig } from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
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

const ReferralLanding = LazyLoadPage(async () => {
  const { ReferralLandingPage } = await import(
    '../pages/referralLanding/ReferralLandingPage'
  );
  return { default: ReferralLandingPage };
});

export const urlAccountRoutes = [
  {
    name: ETabHomeRoutes.TabHomeUrlAccountPage,
    component: UrlAccountPageContainer,
  },
];

// Rewrite pattern for referral landing with app redirect: /r/:code/app/:page
export const referralLandingRewrite = '/r/:code/app/:page';
// Rewrite pattern for referral landing without page: /r/:code/app
export const referralLandingRewriteWithoutPage = '/r/:code/app';
// Rewrite pattern for referral landing with code only: /r/:code
export const referralLandingRewriteCodeOnly = '/r/:code';

export const homeRouters: ITabSubNavigatorConfig<any, any>[] = [
  {
    name: ETabHomeRoutes.TabHome,
    component: HomePageContainer,
    // translationId: 'wallet__wallet',
    rewrite: '/',
    headerShown: !platformEnv.isNative,
  },
  {
    // web refresh will match this route first, make sure it's different url from the home route
    name: ETabHomeRoutes.TabHomeUrlAccountLanding,
    component: UrlAccountLanding,
    rewrite: urlAccountLandingRewrite,
    exact: true,
  },
  {
    name: ETabHomeRoutes.TabHomeUrlAccountPage,
    component: UrlAccountPageContainer,
    exact: true,
  },
  {
    // Referral landing page with app redirect: /r/:code/app/:page
    // e.g., /r/65OUPH/app/perp -> navigates to perp page with referral code
    name: ETabHomeRoutes.TabHomeReferralLanding,
    component: ReferralLanding,
    rewrite: referralLandingRewrite,
    exact: true,
  },
  {
    // Referral landing page without page param: /r/:code/app
    // e.g., /r/65OUPH/app -> navigates to home page with referral code
    name: ETabHomeRoutes.TabHomeReferralLandingWithoutPage,
    component: ReferralLanding,
    rewrite: referralLandingRewriteWithoutPage,
    exact: true,
  },
  {
    // Referral landing page with code only: /r/:code
    // e.g., /r/65OUPH -> navigates to home page with referral code
    name: ETabHomeRoutes.TabHomeReferralLandingCodeOnly,
    component: ReferralLanding,
    rewrite: referralLandingRewriteCodeOnly,
    exact: true,
  },
];
