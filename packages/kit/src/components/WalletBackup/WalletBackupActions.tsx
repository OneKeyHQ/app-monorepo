import type { ComponentProps } from 'react';

import { useIntl } from 'react-intl';

import type { IKeyOfIcons } from '@onekeyhq/components';
import { ActionList } from '@onekeyhq/components';
import type { IDBWallet } from '@onekeyhq/kit-bg/src/dbs/local/types';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';

import { useBackUpWallet } from '../../hooks/useBackUpWallet';

export function WalletBackupActions({
  wallet,
  children,
  onSelected,
  actionListProps,
  onClose,
  hideLiteCard,
  hideKeyTag,
  hidePhrase,
  hideCloud,
}: {
  wallet: IDBWallet | undefined;
  children: React.ReactNode;
  onSelected?: () => void;
  onClose?: () => void;
  actionListProps?: Partial<ComponentProps<typeof ActionList>>;
  hideLiteCard?: boolean;
  hideKeyTag?: boolean;
  hidePhrase?: boolean;
  hideCloud?: boolean;
}) {
  const intl = useIntl();

  const {
    handleBackUpByPhrase,
    handleBackUpByLiteCard,
    handleBackUpByKeyTag,
    handleBackUpByCloud,
    supportCloudBackup,
    cloudBackupFeatureInfo,
  } = useBackUpWallet({ walletId: wallet?.id ?? '' });

  return (
    <ActionList
      title={intl.formatMessage({ id: ETranslations.global_backup })}
      items={[
        !hideCloud &&
        supportCloudBackup &&
        cloudBackupFeatureInfo &&
        wallet?.id &&
        accountUtils.isHdWallet({ walletId: wallet?.id ?? '' })
          ? {
              label: cloudBackupFeatureInfo?.title || '',
              icon: cloudBackupFeatureInfo?.icon as IKeyOfIcons,
              onPress: async () => {
                void handleBackUpByCloud();
                onSelected?.();
              },
              onClose,
            }
          : undefined,
        !hidePhrase && {
          label: intl.formatMessage({
            id: ETranslations.manual_backup,
          }),
          icon: 'SignatureOutline' as IKeyOfIcons,
          onPress: () => {
            void handleBackUpByPhrase();
            onSelected?.();
          },
          onClose,
        },
        !hideLiteCard &&
          platformEnv.isNative && {
            label: intl.formatMessage({
              id: ETranslations.global_onekey_lite,
            }),
            icon: 'OnekeyLiteOutline' as IKeyOfIcons,
            onPress: () => {
              void handleBackUpByLiteCard();
              onSelected?.();
            },
            onClose,
          },
        !hideKeyTag && {
          label: intl.formatMessage({
            id: ETranslations.global_onekey_keytag,
          }),
          icon: 'OnekeyKeytagOutline' as IKeyOfIcons,
          onPress: () => {
            void handleBackUpByKeyTag();
            onSelected?.();
          },
          onClose,
        },
      ].filter(Boolean)}
      renderTrigger={children}
      {...actionListProps}
    />
  );
}
