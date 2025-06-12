import type { ComponentProps } from 'react';
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

export function WalletBackupActions({
  wallet,
  children,
  onSelected,
  actionListProps,
  onClose,
}: {
  wallet: IDBWallet | undefined;
  children: React.ReactNode;
  onSelected?: () => void;
  onClose?: () => void;
  actionListProps?: Partial<ComponentProps<typeof ActionList>>;
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
        isWalletBackedUp: wallet.backuped,
        walletId: wallet.id,
      },
    });

    defaultLogger.account.wallet.backupWallet('manualBackup');
    onSelected?.();
  }, [navigation, wallet?.id, wallet?.backuped, onSelected]);

  const handleBackupLiteCard = useCallback(async () => {
    onSelected?.();
    await liteCard.backupWallet(wallet?.id);

    defaultLogger.account.wallet.backupWallet('liteCard');
  }, [onSelected, liteCard, wallet?.id]);

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
          wallet,
          encodedText,
          title: wallet.name,
        },
      });
      defaultLogger.account.wallet.backupWallet('keyTag');
      onSelected?.();
    }
  }, [navigation, wallet, onSelected]);

  return (
    <ActionList
      placement="bottom-start"
      title={intl.formatMessage({ id: ETranslations.global_backup })}
      items={[
        {
          label: intl.formatMessage({
            id: ETranslations.manual_backup,
          }),
          icon: 'SignatureOutline' as IKeyOfIcons,
          onPress: () => void handleBackupPhrase(),
          onClose,
        },
        platformEnv.isNative && {
          label: intl.formatMessage({
            id: ETranslations.global_onekey_lite,
          }),
          icon: 'OnekeyLiteOutline' as IKeyOfIcons,
          onPress: () => void handleBackupLiteCard(),
          onClose,
        },
        {
          label: intl.formatMessage({
            id: ETranslations.global_onekey_keytag,
          }),
          icon: 'OnekeyKeytagOutline' as IKeyOfIcons,
          onPress: () => void handleBackupKeyTag(),
          onClose,
        },
      ].filter(Boolean)}
      renderTrigger={children}
      {...actionListProps}
    />
  );
}
