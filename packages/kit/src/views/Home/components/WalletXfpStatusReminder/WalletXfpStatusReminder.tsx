import { useEffect, useMemo } from 'react';

import { useIntl } from 'react-intl';

import type { IStackProps } from '@onekeyhq/components';
import {
  Button,
  Dialog,
  Icon,
  SizableText,
  XStack,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import {
  hardwareWalletXfpStatusAtom,
  useHardwareWalletXfpStatusAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { appLocale } from '@onekeyhq/shared/src/locale/appLocale';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

export function WalletXfpReminderAlert({
  message,
  onPress,
  containerProps,
}: {
  message: string;
  onPress?: () => any;
  containerProps?: IStackProps;
}) {
  const intl = useIntl();
  return (
    <XStack
      px="$5"
      py="$2"
      borderTopWidth="$px"
      borderBottomWidth="$px"
      bg="$bgInfoSubdued"
      borderColor="$borderInfoSubdued"
      alignItems="center"
      gap="$2"
      flex={1}
      {...containerProps}
    >
      <Icon size="$5" name="CubeOutline" color="$iconInfo" />
      <SizableText
        flex={1}
        size="$bodyMdMedium"
        color="$text"
        numberOfLines={1}
      >
        {message}
      </SizableText>
      <Button size="small" onPress={onPress}>
        {intl.formatMessage({ id: ETranslations.global_view })}
      </Button>
    </XStack>
  );
}

export async function showUpdateHardwareWalletLegacyXfpDialog({
  walletId,
  onConfirm,
}: {
  walletId: string;
  onConfirm?: () => void;
}) {
  const status = await hardwareWalletXfpStatusAtom.get();
  if (status?.[walletId]?.xfpMissing) {
    Dialog.show({
      icon: 'CubeOutline',
      title: appLocale.intl.formatMessage({
        id: ETranslations.global_hardware_legacy_data_update_dialog_title,
      }),
      description: appLocale.intl.formatMessage(
        {
          id: ETranslations.global_hardware_legacy_data_update_dialog_description,
        },
        {
          walletName: 'OneKey',
        },
      ),
      dismissOnOverlayPress: false,
      showCancelButton: false,
      onConfirm: async () => {
        await backgroundApiProxy.serviceAccount.generateWalletsMissingMetaWithUserInteraction(
          {
            walletId,
          },
        );
        onConfirm?.();
      },
      onConfirmText: appLocale.intl.formatMessage({
        id: ETranslations.global_hardware_legacy_data_update_dialog_button,
      }),
    });
  } else {
    onConfirm?.();
  }
}

function WalletXfpStatusReminderCmp() {
  const intl = useIntl();
  const { activeAccount } = useActiveAccount({ num: 0 });
  const walletId = activeAccount?.wallet?.id;
  const deprecated = activeAccount?.wallet?.deprecated;

  const [hardwareWalletXfpStatus] = useHardwareWalletXfpStatusAtom();

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const navigation = useAppNavigation();

  useEffect(() => {
    void (async () => {
      if (walletId) {
        await backgroundApiProxy.serviceAccount.generateWalletsMissingMetaSilently(
          {
            walletId,
          },
        );
      }
    })();
  }, [walletId]);

  const updateButton = useMemo(() => {
    if (
      !deprecated &&
      walletId &&
      hardwareWalletXfpStatus?.[walletId]?.xfpMissing
    ) {
      const message = intl.formatMessage({
        id: ETranslations.global_hardware_legacy_data_update_banner_title,
      });
      return (
        <WalletXfpReminderAlert
          message={message}
          onPress={async () => {
            await showUpdateHardwareWalletLegacyXfpDialog({ walletId });
          }}
        />
      );
    }
    return null;
  }, [walletId, hardwareWalletXfpStatus, intl, deprecated]);

  return <XStack>{updateButton}</XStack>;
}

export function WalletXfpStatusReminder() {
  return (
    <AccountSelectorProviderMirror
      config={{
        sceneName: EAccountSelectorSceneName.home,
      }}
      enabledNum={[0]}
    >
      <WalletXfpStatusReminderCmp />
    </AccountSelectorProviderMirror>
  );
}
