import { resetToRoute } from '@onekeyhq/components';
import {
  EOnboardingPagesV2,
  EOnboardingV2Routes,
  ERootRoutes,
} from '@onekeyhq/shared/src/routes';

export const navigateToBackupWalletReminderPage = ({
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
  // Atomically replace overlay routes with the target route in a single reset.
  // Using resetAboveMainRoute() + navigate() causes a race condition on iOS:
  // the native modal dismiss animation from reset can pop the subsequently
  // navigated route. See OK-50182 / 2cabd040.
  resetToRoute(ERootRoutes.Onboarding, {
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
