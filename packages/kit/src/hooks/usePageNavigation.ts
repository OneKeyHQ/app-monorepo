import { resetToRoute } from '@onekeyhq/components';
import type { IDBWallet } from '@onekeyhq/kit-bg/src/dbs/local/types';
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

// Same atomic-reset entry pattern as above (OK-50182): the KeyTag content pages
// (view dots, enter phrase, interactive import) live in the Onboarding V2 page
// stack, while the KeyTag hub + wallet selector stay in KeyTagModal. These
// helpers cross that modal→V2 boundary race-safely.
export const navigateToKeyTagBackupDotMapPage = ({
  wallet,
  encodedText,
  title,
}: {
  wallet?: IDBWallet;
  encodedText: string;
  title: string;
}) => {
  resetToRoute(ERootRoutes.Onboarding, {
    screen: EOnboardingV2Routes.OnboardingV2,
    params: {
      screen: EOnboardingPagesV2.KeyTagBackupDotMap,
      params: {
        wallet,
        encodedText,
        title,
      },
    },
  });
};

export const navigateToKeyTagImportPage = () => {
  resetToRoute(ERootRoutes.Onboarding, {
    screen: EOnboardingV2Routes.OnboardingV2,
    params: {
      screen: EOnboardingPagesV2.ImportKeyTag,
    },
  });
};

export const navigateToKeyTagEnterPhrasePage = () => {
  resetToRoute(ERootRoutes.Onboarding, {
    screen: EOnboardingV2Routes.OnboardingV2,
    params: {
      screen: EOnboardingPagesV2.KeyTagEnterPhrase,
    },
  });
};
