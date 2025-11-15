import type { ComponentProps } from 'react';

import { useIntl } from 'react-intl';

import type { IKeyOfIcons } from '@onekeyhq/components';
import { ActionList } from '@onekeyhq/components';
import type { IDBWallet } from '@onekeyhq/kit-bg/src/dbs/local/types';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { ERootRoutes } from '@onekeyhq/shared/src/routes';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';

import useAppNavigation from '../../hooks/useAppNavigation';
import { useBackUpWallet } from '../../hooks/useBackUpWallet';
import { useCloudBackup } from '../../views/Onboardingv2/hooks/useCloudBackup';

export function WalletBackupActions({
  wallet,
  children,
  onSelected,
  actionListProps,
  onClose,
  hideLiteCard,
  hideKeyTag,
  hidePhrase,
}: {
  wallet: IDBWallet | undefined;
  children: React.ReactNode;
  onSelected?: () => void;
  onClose?: () => void;
  actionListProps?: Partial<ComponentProps<typeof ActionList>>;
  hideLiteCard?: boolean;
  hideKeyTag?: boolean;
  hidePhrase?: boolean;
}) {
  const intl = useIntl();

  const { handleBackUpByPhrase, handleBackUpByLiteCard, handleBackUpByKeyTag } =
    useBackUpWallet({ walletId: wallet?.id ?? '' });
  const { supportCloudBackup, cloudBackupFeatureInfo, startBackup } =
    useCloudBackup();
  const navigation = useAppNavigation();

  return (
    <ActionList
      title={intl.formatMessage({ id: ETranslations.global_backup })}
      items={[
        supportCloudBackup &&
        cloudBackupFeatureInfo &&
        wallet?.id &&
        accountUtils.isHdWallet({ walletId: wallet?.id ?? '' })
          ? {
              label: cloudBackupFeatureInfo?.title || '',
              icon: cloudBackupFeatureInfo?.icon as IKeyOfIcons,
              onPress: async () => {
                // navigation.popStack();
                navigation.navigate(ERootRoutes.Main, undefined, {
                  pop: true,
                });
                await timerUtils.wait(100);
                await startBackup({
                  alwaysGoToBackupDetail: true,
                });
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
