import type { IModalFlowNavigatorConfig } from '@onekeyhq/components';
import type { IManualBackupParamList } from '@onekeyhq/shared/src/routes/manualBackup';
import { EManualBackupRoutes } from '@onekeyhq/shared/src/routes/manualBackup';
import { EOnboardingPages } from '@onekeyhq/shared/src/routes/onboarding';

import { LazyLoadPage } from '../../../components/LazyLoadPage';

const OnboardingBeforeShowRecoveryPhrase = LazyLoadPage(
  () => import('../../Onboarding/pages/CreateWalet/BeforeShowRecoveryPhrase'),
);
const OnboardingRecoveryPhrase = LazyLoadPage(
  () => import('../../Onboarding/pages/CreateWalet/RecoveryPhrase'),
);
const OnboardingVerifyRecoverPhrase = LazyLoadPage(
  () => import('../../Onboarding/pages/CreateWalet/VerifyRecoverPhrase'),
);
const ManualBackupSelectWalletPage = LazyLoadPage(
  () => import('../pages/SelectWallet'),
);

export const ManualBackupRouter: IModalFlowNavigatorConfig<
  EManualBackupRoutes | EOnboardingPages,
  IManualBackupParamList
>[] = [
  {
    name: EManualBackupRoutes.ManualBackupSelectWallet,
    component: ManualBackupSelectWalletPage,
  },
  {
    name: EOnboardingPages.BeforeShowRecoveryPhrase,
    component: OnboardingBeforeShowRecoveryPhrase,
  },
  {
    name: EOnboardingPages.RecoveryPhrase,
    component: OnboardingRecoveryPhrase,
  },
  {
    name: EOnboardingPages.VerifyRecoverPhrase,
    component: OnboardingVerifyRecoverPhrase,
  },
];
