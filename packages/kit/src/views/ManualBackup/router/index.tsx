import type { IModalFlowNavigatorConfig } from '@onekeyhq/components';
import type { IManualBackupParamList } from '@onekeyhq/shared/src/routes/manualBackup';
import { EManualBackupRoutes } from '@onekeyhq/shared/src/routes/manualBackup';
import { EOnboardingPages } from '@onekeyhq/shared/src/routes/onboarding';

import OnboardingBeforeShowRecoveryPhrase from '../../Onboarding/pages/CreateWalet/BeforeShowRecoveryPhrase';
import OnboardingRecoveryPhrase from '../../Onboarding/pages/CreateWalet/RecoveryPhrase';
import OnboardingVerifyRecoverPhrase from '../../Onboarding/pages/CreateWalet/VerifyRecoverPhrase';
import ManualBackupSelectWalletPage from '../pages/SelectWallet';

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
