import { useCallback } from 'react';

import { rootNavigationRef } from '@onekeyhq/components';
import { ensureSensitiveTextEncoded } from '@onekeyhq/core/src/secret';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import {
  EModalKeyTagRoutes,
  EModalRoutes,
  EOnboardingPagesV2,
  EOnboardingV2Routes,
  ERootRoutes,
} from '@onekeyhq/shared/src/routes';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import { EReasonForNeedPassword } from '@onekeyhq/shared/types/setting';

import backgroundApiProxy from '../background/instance/backgroundApiProxy';
import useLiteCard from '../views/LiteCard/hooks/useLiteCard';
import { useCloudBackup } from '../views/Onboardingv2/hooks/useCloudBackup';

import { useAccountData } from './useAccountData';
import useAppNavigation from './useAppNavigation';

function useBackUpWallet({ walletId }: { walletId: string }) {
  const { wallet } = useAccountData({ walletId });

  const navigation = useAppNavigation();

  const liteCard = useLiteCard();

  const { supportCloudBackup, startBackup } = useCloudBackup();

  const handleBackUpByPhrase = useCallback(async () => {
    if (!wallet?.id) {
      return;
    }
    const { mnemonic } =
      await backgroundApiProxy.serviceAccount.getHDAccountMnemonic({
        walletId: wallet?.id,
        reason: EReasonForNeedPassword.Security,
      });
    if (mnemonic) ensureSensitiveTextEncoded(mnemonic);

    const state = rootNavigationRef.current?.getRootState();
    if (state && state.routes.length > 0) {
      const currentRoute = state.routes[state.index];
      if (currentRoute.name === ERootRoutes.Modal) {
        navigation.popStack();
      }
      await timerUtils.wait(250);
      navigation.navigate(ERootRoutes.Onboarding, {
        screen: EOnboardingV2Routes.OnboardingV2,
        params: {
          screen: EOnboardingPagesV2.BackupWalletReminder,
          params: {
            mnemonic,
            isWalletBackedUp: wallet.backuped,
            walletId: wallet.id,
          },
        },
      });
    }
    defaultLogger.account.wallet.backupWallet('manualBackup');
  }, [navigation, wallet?.backuped, wallet?.id]);

  const handleBackUpByLiteCard = useCallback(async () => {
    await liteCard.backupWallet(wallet?.id);

    defaultLogger.account.wallet.backupWallet('liteCard');
  }, [liteCard, wallet?.id]);

  const handleBackUpByKeyTag = useCallback(async () => {
    if (wallet) {
      const { mnemonic: encodedText } =
        await backgroundApiProxy.serviceAccount.getHDAccountMnemonic({
          walletId: wallet.id,
          reason: EReasonForNeedPassword.Security,
        });
      if (encodedText) ensureSensitiveTextEncoded(encodedText);
      navigation.pushModal(EModalRoutes.KeyTagModal, {
        screen: EModalKeyTagRoutes.BackupDotMap,
        params: {
          wallet,
          encodedText,
          title: wallet.name,
        },
      });
      defaultLogger.account.wallet.backupWallet('keyTag');
    }
  }, [navigation, wallet]);

  const handleBackUpByCloud = useCallback(async () => {
    await startBackup();
    defaultLogger.account.wallet.backupWallet('cloud');
  }, [startBackup]);

  return {
    handleBackUpByPhrase,
    handleBackUpByLiteCard,
    handleBackUpByKeyTag,
    handleBackUpByCloud,
    supportCloudBackup,
  };
}

export { useBackUpWallet };
