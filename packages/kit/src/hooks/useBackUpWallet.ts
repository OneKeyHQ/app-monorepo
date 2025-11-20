import { useCallback } from 'react';

import { ensureSensitiveTextEncoded } from '@onekeyhq/core/src/secret';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import {
  EModalKeyTagRoutes,
  EModalRoutes,
  ERootRoutes,
} from '@onekeyhq/shared/src/routes';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import { EReasonForNeedPassword } from '@onekeyhq/shared/types/setting';

import backgroundApiProxy from '../background/instance/backgroundApiProxy';
import useLiteCard from '../views/LiteCard/hooks/useLiteCard';
import { useCloudBackup } from '../views/Onboardingv2/hooks/useCloudBackup';

import { useAccountData } from './useAccountData';
import useAppNavigation from './useAppNavigation';
import { navigateToBackupWalletReminderPage } from './usePageNavigation';

function useBackUpWallet({ walletId }: { walletId: string }) {
  const { wallet } = useAccountData({ walletId });

  const navigation = useAppNavigation();
  const liteCard = useLiteCard();

  const { supportCloudBackup, cloudBackupFeatureInfo, startBackup } =
    useCloudBackup();

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

    await navigateToBackupWalletReminderPage({
      walletId: wallet?.id ?? '',
      isWalletBackedUp: wallet?.backuped ?? false,
      mnemonic,
    });
    defaultLogger.account.wallet.backupWallet('manualBackup');
  }, [wallet?.backuped, wallet?.id]);

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
    defaultLogger.account.wallet.backupWallet('cloud');

    navigation.navigate(ERootRoutes.Main, undefined, {
      pop: true,
    });
    await timerUtils.wait(100);
    await startBackup({
      alwaysGoToBackupDetail: true,
    });
    defaultLogger.account.wallet.backupWallet('cloud');
  }, [navigation, startBackup]);

  return {
    handleBackUpByPhrase,
    handleBackUpByLiteCard,
    handleBackUpByKeyTag,
    handleBackUpByCloud,
    supportCloudBackup,
    cloudBackupFeatureInfo,
  };
}

export { useBackUpWallet };
