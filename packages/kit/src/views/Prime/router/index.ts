/* cspell:ignore Infini */
import type { IModalFlowNavigatorConfig } from '@onekeyhq/components';
import type {
  IPrimeGiftParamList,
  IPrimeParamList,
} from '@onekeyhq/shared/src/routes/prime';
import {
  EPrimeGiftPages,
  EPrimePages,
} from '@onekeyhq/shared/src/routes/prime';

import { LazyLoadPage } from '../../../components/LazyLoadPage';
import { withPrimeAccountGuard } from '../components/PrimeAccountGuard';

const PrimeDashboard = withPrimeAccountGuard(
  LazyLoadPage(() => import('../pages/PrimeDashboard')),
);
const PrimeDeviceLimit = withPrimeAccountGuard(
  LazyLoadPage(() => import('../pages/PrimeDeviceLimit')),
);
const PrimeCloudSync = withPrimeAccountGuard(
  LazyLoadPage(() => import('../pages/PrimeCloudSync')),
);
const PrimeCloudSyncDebug = withPrimeAccountGuard(
  LazyLoadPage(() => import('../pages/PrimeCloudSync/PagePrimeCloudSyncDebug')),
);
const PrimeCloudSyncInfo = withPrimeAccountGuard(
  LazyLoadPage(() => import('../pages/PrimeCloudSync/PagePrimeCloudSyncInfo')),
);
const PrimeFeatures = withPrimeAccountGuard(
  LazyLoadPage(() => import('../pages/PrimeFeatures')),
);
const PrimeDeleteAccount = LazyLoadPage(
  () => import('../pages/PrimeDeleteAccount'),
);
const PrimeTransfer = LazyLoadPage(() => import('../pages/PagePrimeTransfer'));
const PrimeTransferPreview = LazyLoadPage(
  () => import('../pages/PagePrimeTransfer/PagePrimeTransferPreview'),
);
const OneKeyId = withPrimeAccountGuard(
  LazyLoadPage(() => import('../pages/OneKeyId')),
);
const OneKeyIdProfileEdit = withPrimeAccountGuard(
  LazyLoadPage(() => import('../pages/OneKeyId/ProfileEditPage')),
);
const PrimeMyOrders = withPrimeAccountGuard(
  LazyLoadPage(() => import('../pages/PrimeMyOrders')),
);
const PrimeInfiniPayment = withPrimeAccountGuard(
  LazyLoadPage(() => import('../pages/PrimeInfiniPayment')),
);
const PrimeInfiniSubscription = withPrimeAccountGuard(
  LazyLoadPage(() => import('../pages/PrimeInfiniSubscription')),
);
const PrimeGift = withPrimeAccountGuard(
  LazyLoadPage(() => import('../pages/PrimeGift')),
);

export const PrimeGiftRouter: IModalFlowNavigatorConfig<
  EPrimeGiftPages,
  IPrimeGiftParamList
>[] = [
  {
    name: EPrimeGiftPages.PrimeGift,
    component: PrimeGift,
    options: {
      headerShown: false,
    },
  },
];

export const PrimeRouter: IModalFlowNavigatorConfig<
  EPrimePages,
  IPrimeParamList
>[] = [
  {
    name: EPrimePages.PrimeDashboard,
    component: PrimeDashboard,
    options: {
      headerShown: false,
    },
  },
  {
    name: EPrimePages.PrimeDeviceLimit,
    component: PrimeDeviceLimit,
  },
  {
    name: EPrimePages.PrimeCloudSync,
    component: PrimeCloudSync,
  },
  {
    name: EPrimePages.PrimeCloudSyncDebug,
    component: PrimeCloudSyncDebug,
  },
  {
    name: EPrimePages.PrimeCloudSyncInfo,
    component: PrimeCloudSyncInfo,
  },
  {
    name: EPrimePages.PrimeFeatures,
    component: PrimeFeatures,
    options: {
      headerShown: false,
    },
  },
  {
    name: EPrimePages.PrimeDeleteAccount,
    component: PrimeDeleteAccount,
  },
  {
    name: EPrimePages.PrimeTransfer,
    component: PrimeTransfer,
    dismissOnOverlayPress: false,
    options: { gestureEnabled: false },
  },
  {
    name: EPrimePages.PrimeTransferPreview,
    component: PrimeTransferPreview,
    dismissOnOverlayPress: false,
    options: { gestureEnabled: false },
  },
  {
    name: EPrimePages.OneKeyId,
    component: OneKeyId,
  },
  {
    name: EPrimePages.OneKeyIdProfileEdit,
    component: OneKeyIdProfileEdit,
  },
  {
    name: EPrimePages.PrimeMyOrders,
    component: PrimeMyOrders,
  },
  {
    name: EPrimePages.PrimeInfiniPayment,
    component: PrimeInfiniPayment,
  },
  {
    name: EPrimePages.PrimeInfiniSubscription,
    component: PrimeInfiniSubscription,
  },
];
