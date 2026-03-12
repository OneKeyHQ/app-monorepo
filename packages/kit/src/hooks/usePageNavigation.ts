import {
  resetAboveMainRoute,
  rootNavigationRef,
} from '@onekeyhq/components';
import {
  EOnboardingPagesV2,
  EOnboardingV2Routes,
  ERootRoutes,
} from '@onekeyhq/shared/src/routes';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';

export const navigateToBackupWalletReminderPage = async ({
  walletId,
  accountName,
  isWalletBackedUp,
  mnemonic,
}: {
  walletId: string;
  accountName?: string;
  isWalletBackedUp: boolean;
  mnemonic: string;
}) => {
  // Use atomic resetAboveMainRoute() instead of sequential goBack() calls
  // to avoid iOS UITabBarController window-nil race condition that causes
  // RNSScreenStack retry storm (~5s freeze). See OK-50182 / 2cabd040.
  resetAboveMainRoute();
  await timerUtils.wait(100);
  rootNavigationRef.current?.navigate(ERootRoutes.Onboarding, {
    screen: EOnboardingV2Routes.OnboardingV2,
    params: {
      screen: EOnboardingPagesV2.BackupWalletReminder,
      params: {
        mnemonic,
        isWalletBackedUp,
        walletId,
        accountName,
      },
    },
  });
};
