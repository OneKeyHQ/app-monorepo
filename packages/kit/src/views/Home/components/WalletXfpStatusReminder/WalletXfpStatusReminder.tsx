import { useEffect, useMemo } from 'react';

import { useIsFocused } from '@react-navigation/core';
import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';

import type { IStackProps, IXStackProps } from '@onekeyhq/components';
import {
  Button,
  Dialog,
  Icon,
  SizableText,
  XStack,
  usePopoverContext,
  useTooltipContext,
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
      pl="$3"
      pr="$2"
      py="$1.5"
      borderWidth={StyleSheet.hairlineWidth}
      bg="$bgInfoSubdued"
      borderColor="$borderInfoSubdued"
      alignItems="center"
      gap="$2"
      borderRadius="$2"
      borderCurve="continuous"
      flex={1}
      {...(containerProps as IXStackProps)}
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
  const { closePopover } = usePopoverContext();
  const { closeTooltip } = useTooltipContext();
  const [hardwareWalletXfpStatus] = useHardwareWalletXfpStatusAtom();

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const navigation = useAppNavigation();

  const isFocused = useIsFocused();

  useEffect(() => {
    void (async () => {
      if (!deprecated && walletId && isFocused) {
        await backgroundApiProxy.serviceAccount.generateWalletsMissingMetaSilently(
          {
            walletId,
          },
        );
      }
    })();
  }, [walletId, isFocused, deprecated]);

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
            await closePopover?.();
            await closeTooltip?.();
            await showUpdateHardwareWalletLegacyXfpDialog({ walletId });
          }}
        />
      );
    }
    return null;
  }, [
    deprecated,
    walletId,
    hardwareWalletXfpStatus,
    intl,
    closePopover,
    closeTooltip,
  ]);

  return updateButton;
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
