import type { IDialogShowProps } from '@onekeyhq/components';
import { Button, Dialog, XStack, YStack } from '@onekeyhq/components';
import type { IDBWallet } from '@onekeyhq/kit-bg/src/dbs/local/types';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { WalletBackupActions } from './WalletBackupActions';

import type { IntlShape } from 'react-intl';

export const showWalletBackupDialog = ({
  wallet,
  intl,
  ...dialogProps
}: IDialogShowProps & {
  wallet: IDBWallet | undefined;
  intl: IntlShape;
}) => {
  const dialog = Dialog.show({
    title: intl.formatMessage({
      id: ETranslations.wallet_backup_prompt,
    }),
    description: intl.formatMessage({
      id: ETranslations.wallet_backup_backup_reminder,
    }),
    icon: 'ErrorOutline',
    tone: 'destructive',
    renderContent: (
      <XStack gap="$2.5">
        <Button
          testID="wallet-backup-dialog-btn"
          size="medium"
          variant="secondary"
          onPress={() => dialog.close()}
          flexGrow={1}
          flexShrink={0}
        >
          {intl.formatMessage({
            id: ETranslations.global_cancel,
          })}
        </Button>
        <YStack flexGrow={1} flexShrink={0}>
          <WalletBackupActions
            wallet={wallet}
            onSelected={() => dialog.close()}
          >
            <Button
              size="medium"
              variant="primary"
              testID="wallet-backup-dialog-btn"
            >
              {intl.formatMessage({
                id: ETranslations.global_backup,
              })}
            </Button>
          </WalletBackupActions>
        </YStack>
      </XStack>
    ),
    showFooter: false,

    ...dialogProps,
  });
};
