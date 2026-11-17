import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import { ERootRoutes } from '@onekeyhq/shared/src/routes';
import { ensureSensitiveTextEncoded } from '@onekeyhq/shared/src/utils/sensitiveTextUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import { EReasonForNeedPassword } from '@onekeyhq/shared/types/setting';

import backgroundApiProxy from '../background/instance/backgroundApiProxy';
import { getManualBackupMnemonic } from '../components/WalletBackup/getManualBackupMnemonic';
import useLiteCard from '../views/LiteCard/hooks/useLiteCard';
import { useCloudBackup } from '../views/Onboardingv2/hooks/useCloudBackup';

import { useAccountData } from './useAccountData';
import useAppNavigation from './useAppNavigation';
import {
  navigateToBackupWalletReminderPage,
  navigateToKeyTagBackupDotMapPage,
} from './usePageNavigation';

function useBackUpWallet({ walletId }: { walletId: string }) {
  const intl = useIntl();
  const { wallet } = useAccountData({ walletId });

  const navigation = useAppNavigation();
  const liteCard = useLiteCard();

  const { supportCloudBackup, cloudBackupFeatureInfo, startBackup } =
    useCloudBackup();

  const handleBackUpByPhrase = useCallback(async () => {
    if (!wallet?.id) {
      return;
    }
    const result = await getManualBackupMnemonic(wallet.id, intl);
    if (!result) return;
    const { mnemonic } = result;
    if (mnemonic) ensureSensitiveTextEncoded(mnemonic);

    navigateToBackupWalletReminderPage({
      walletId: wallet?.id ?? '',
      isWalletBackedUp: wallet?.backuped ?? false,
      mnemonic,
    });
    defaultLogger.account.wallet.backupWallet('manualBackup');
  }, [wallet?.backuped, wallet?.id, intl]);

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
      navigateToKeyTagBackupDotMapPage({
        walletId: wallet.id,
        isWalletBackedUp: wallet.backuped,
        encodedText,
        title: wallet.name,
      });
      defaultLogger.account.wallet.backupWallet('keyTag');
    }
  }, [wallet]);

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
