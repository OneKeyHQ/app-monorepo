import { useCallback } from 'react';

import { ensureSensitiveTextEncoded } from '@onekeyhq/core/src/secret';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import {
  EModalKeyTagRoutes,
  EModalRoutes,
  EOnboardingPages,
} from '@onekeyhq/shared/src/routes';
import { EReasonForNeedPassword } from '@onekeyhq/shared/types/setting';

import backgroundApiProxy from '../background/instance/backgroundApiProxy';
import useLiteCard from '../views/LiteCard/hooks/useLiteCard';

import { useAccountData } from './useAccountData';
import useAppNavigation from './useAppNavigation';

function useBackUpWallet({ walletId }: { walletId: string }) {
  const { wallet } = useAccountData({ walletId });

  const navigation = useAppNavigation();

  const liteCard = useLiteCard();

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
    navigation.pushModal(EModalRoutes.OnboardingModal, {
      screen: EOnboardingPages.BeforeShowRecoveryPhrase,
      params: {
        mnemonic,
        isBackup: true,
        isWalletBackedUp: wallet.backuped,
        walletId: wallet.id,
      },
    });

    defaultLogger.account.wallet.backupWallet('manualBackup');
  }, [navigation, wallet?.id, wallet?.backuped]);

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

  const handleBackUpByiCloud = useCallback(async () => {
    // TODO: Implement iCloud backup
  }, []);

  const handleBackUpByGoogleDrive = useCallback(async () => {
    // TODO: Implement Google Drive backup
  }, []);

  return {
    handleBackUpByPhrase,
    handleBackUpByLiteCard,
    handleBackUpByKeyTag,
    handleBackUpByiCloud,
    handleBackUpByGoogleDrive,
  };
}

export { useBackUpWallet };
