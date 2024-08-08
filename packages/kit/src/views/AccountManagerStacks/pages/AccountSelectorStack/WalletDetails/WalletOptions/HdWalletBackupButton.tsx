import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import type { IKeyOfIcons } from '@onekeyhq/components';
import { ActionList } from '@onekeyhq/components';
import { ensureSensitiveTextEncoded } from '@onekeyhq/core/src/secret';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import useLiteCard from '@onekeyhq/kit/src/views/LiteCard/hooks/useLiteCard';
import type { IDBWallet } from '@onekeyhq/kit-bg/src/dbs/local/types';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import {
  EModalKeyTagRoutes,
  EModalRoutes,
  EOnboardingPages,
} from '@onekeyhq/shared/src/routes';
import { EReasonForNeedPassword } from '@onekeyhq/shared/types/setting';

import { WalletOptionItem } from './WalletOptionItem';

export function HdWalletBackupButton({
  wallet,
}: {
  wallet: IDBWallet | undefined;
}) {
  const navigation = useAppNavigation();
  const intl = useIntl();

  const liteCard = useLiteCard();

  const handleBackupPhrase = useCallback(async () => {
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
      },
    });

    defaultLogger.account.wallet.backupWallet('manualBackup');
  }, [navigation, wallet?.id]);

  const handleBackupLiteCard = useCallback(() => {
    void liteCard.backupWallet(wallet?.id);
    defaultLogger.account.wallet.backupWallet('liteCard');
  }, [liteCard, wallet?.id]);

  const handleBackupKeyTag = useCallback(async () => {
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
          encodedText,
          title: wallet.name,
        },
      });
      defaultLogger.account.wallet.backupWallet('keyTag');
    }
  }, [navigation, wallet]);

  return (
    <ActionList
      offset={{ mainAxis: 0, crossAxis: 18 }}
      placement="bottom-start"
      title={intl.formatMessage({ id: ETranslations.global_backup })}
      items={[
        {
          label: intl.formatMessage({
            id: ETranslations.manual_backup,
          }),
          icon: 'PenOutline' as IKeyOfIcons,
          onPress: () => void handleBackupPhrase(),
        },
        platformEnv.isNative && {
          label: intl.formatMessage({
            id: ETranslations.global_onekey_lite,
          }),
          icon: 'OnekeyLiteOutline' as IKeyOfIcons,
          onPress: handleBackupLiteCard,
        },
        {
          label: intl.formatMessage({
            id: ETranslations.global_onekey_keytag,
          }),
          icon: 'OnekeyKeytagOutline' as IKeyOfIcons,
          onPress: () => void handleBackupKeyTag(),
        },
      ].filter(Boolean)}
      renderTrigger={
        <WalletOptionItem
          testID="AccountSelector-WalletOption-Backup"
          icon="Shield2CheckOutline"
          label={intl.formatMessage({ id: ETranslations.global_backup })}
        />
      }
    />
  );
}
