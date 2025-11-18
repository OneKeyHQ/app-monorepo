import { rootNavigationRef } from '@onekeyhq/components';
import {
  EOnboardingPagesV2,
  EOnboardingV2Routes,
  ERootRoutes,
} from '@onekeyhq/shared/src/routes';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';

export const closeModalPages = async () => {
  const state = rootNavigationRef.current?.getRootState();
  if (state) {
    const currentRoute = state.routes[state.index];
    if (currentRoute.name === ERootRoutes.Modal) {
      if (rootNavigationRef.current?.canGoBack?.()) {
        rootNavigationRef.current?.goBack();
        await timerUtils.wait(150);
        await closeModalPages();
      }
    }
  }
};

export const closeOnboardingPages = async () => {
  const state = rootNavigationRef.current?.getRootState();
  if (state) {
    const currentRoute = state.routes[state.index];
    if (currentRoute.name === ERootRoutes.Onboarding) {
      if (rootNavigationRef.current?.canGoBack?.()) {
        rootNavigationRef.current?.goBack();
        await timerUtils.wait(150);
        await closeOnboardingPages();
      }
    }
  }
};

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
  await closeModalPages();
  await timerUtils.wait(250);
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
