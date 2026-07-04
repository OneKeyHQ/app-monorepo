import type { ITabSubNavigatorConfig } from '@onekeyhq/components';
import { ETabHomeRoutes } from '@onekeyhq/shared/src/routes';

import {
  LazyLoadPage,
  LazyLoadRootTabPage,
} from '../../../components/LazyLoadPage';
import { urlAccountLandingRewrite } from '../pages/urlAccount/urlAccountUtils';

const HomePageContainer = LazyLoadRootTabPage(
  () => import('../pages/HomePageContainer'),
);

const UrlAccountPageContainer = LazyLoadPage(async () => {
  const { UrlAccountPageContainer: UrlAccountPageContainerModule } =
    await import('../pages/urlAccount/UrlAccountPage');
  return { default: UrlAccountPageContainerModule };
});

const UrlAccountLanding = LazyLoadPage(async () => {
  const { UrlAccountLanding: UrlAccountLandingModule } =
    await import('../pages/urlAccount/UrlAccountPage');
  return { default: UrlAccountLandingModule };
});

const ReferralLanding = LazyLoadPage(async () => {
  const { ReferralLandingPage } =
    await import('../pages/referralLanding/ReferralLandingPage');
  return { default: ReferralLandingPage };
});

const RedeemBitcoinVoucherLanding = LazyLoadPage(async () => {
  const { RedeemBitcoinVoucherLandingPage } =
    await import('../pages/redeemBitcoinVoucher/RedeemBitcoinVoucherLandingPage');
  return { default: RedeemBitcoinVoucherLandingPage };
});

const BulkSendAddressesInput = LazyLoadPage(
  () => import('@onekeyhq/kit/src/views/BulkSend/pages/BulkSendAddressesInput'),
);

const BulkSendAmountsInput = LazyLoadPage(
  () => import('@onekeyhq/kit/src/views/BulkSend/pages/BulkSendAmountsInput'),
);

const BulkSendProcess = LazyLoadPage(
  () => import('@onekeyhq/kit/src/views/BulkSend/pages/BulkSendProcess'),
);

const ApprovalListPage = LazyLoadPage(
  () => import('../pages/ApprovalListPage'),
);

export const urlAccountRoutes = [
  {
    name: ETabHomeRoutes.TabHomeUrlAccountPage,
    component: UrlAccountPageContainer,
  },
];

export const referralLandingRewrite = '/r/:code/app/:page';
export const referralLandingRewriteWithoutPage = '/r/:code/app';
export const referralLandingRewriteCodeOnly = '/r/:code';
export const redeemBitcoinVoucherLandingRewrite = '/redeem-bitcoin-voucher';

export const homeRouters: ITabSubNavigatorConfig<any, any>[] = [
  {
    name: ETabHomeRoutes.TabHome,
    component: HomePageContainer,
    rewrite: '/',
    headerShown: true,
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
    exact: true,
  },
  {
    name: ETabHomeRoutes.TabHomeReferralLanding,
    component: ReferralLanding,
    rewrite: referralLandingRewrite,
    exact: true,
    headerShown: false,
  },
  {
    name: ETabHomeRoutes.TabHomeReferralLandingWithoutPage,
    component: ReferralLanding,
    rewrite: referralLandingRewriteWithoutPage,
    exact: true,
    headerShown: false,
  },
  {
    name: ETabHomeRoutes.TabHomeReferralLandingCodeOnly,
    component: ReferralLanding,
    rewrite: referralLandingRewriteCodeOnly,
    exact: true,
    headerShown: false,
  },
  {
    name: ETabHomeRoutes.TabHomeRedeemBitcoinVoucher,
    component: RedeemBitcoinVoucherLanding,
    rewrite: redeemBitcoinVoucherLandingRewrite,
    exact: true,
    headerShown: false,
  },
  {
    name: ETabHomeRoutes.TabHomeBulkSendAddressesInput,
    component: BulkSendAddressesInput,
    exact: true,
    rewrite: '/bulk-send-addresses',
  },
  {
    name: ETabHomeRoutes.TabHomeBulkSendAmountsInput,
    component: BulkSendAmountsInput,
    rewrite: '/bulk-send-amounts',
  },
  {
    name: ETabHomeRoutes.TabHomeBulkSendProcess,
    component: BulkSendProcess,
    rewrite: '/bulk-send-process',
  },
  {
    name: ETabHomeRoutes.TabHomeApprovalList,
    component: ApprovalListPage,
    exact: true,
    rewrite: '/approval-list',
  },
];
