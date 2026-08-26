import { useCallback, useState } from 'react';

import { useIntl } from 'react-intl';

import { Dialog, YStack } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { hardwareUiStateDialogLifecycle } from '@onekeyhq/kit/src/provider/Container/HardwareUiStateContainer/hardwareUiStateDialogLifecycle';
import { isLegacyHardwareUiActive } from '@onekeyhq/shared/src/hardware/deviceStageOwnership';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

export function SelectAddWalletTypeDialogContent({
  onAddStandardWalletPress,
  onAddHiddenWalletPress,
}: {
  onAddStandardWalletPress: () => void;
  onAddHiddenWalletPress: () => void;
}) {
  const intl = useIntl();

  return (
    <YStack>
      <Dialog.Header>
        <Dialog.Title>
          {intl.formatMessage({
            id: ETranslations.global_select_wallet_type_to_add,
          })}
        </Dialog.Title>
      </Dialog.Header>
      <YStack gap="$4">
        <ListItem
          px="$4"
          mx="$0"
          py="$3"
          borderRadius="$2"
          borderCurve="continuous"
          borderWidth={1}
          borderColor="$borderSubdued"
          icon="WalletOutline"
          title={intl.formatMessage({
            id: ETranslations.global_standard_wallet,
          })}
          subtitle={intl.formatMessage({
            id: ETranslations.global_standard_wallet_desc,
          })}
          onPress={onAddStandardWalletPress}
          nativePressableStyle={{ flexShrink: 0 }}
        >
          <ListItem.DrillIn />
        </ListItem>

        <ListItem
          px="$4"
          mx="$0"
          py="$3"
          borderRadius="$2"
          borderCurve="continuous"
          borderWidth={1}
          borderColor="$borderSubdued"
          icon="LockOutline"
          iconProps={{
            alignSelf: 'flex-start',
          }}
          title={intl.formatMessage({
            id: ETranslations.global_hidden_wallet,
          })}
          subtitle={intl.formatMessage({
            id: ETranslations.global_hidden_wallet_desc,
          })}
          onPress={onAddHiddenWalletPress}
          nativePressableStyle={{ flexShrink: 0 }}
        >
          <ListItem.DrillIn />
        </ListItem>
      </YStack>
    </YStack>
  );
}

export function useSelectAddWalletTypeDialog() {
  const [isLoading, setIsLoading] = useState(false);

  // return promise
  const showSelectAddWalletTypeDialog = useCallback(async (): Promise<
    'Standard' | 'Hidden' | undefined
  > => {
    // iOS-only: dismiss the hardware-UI dialog before mounting this one.
    // Both dialogs render into FULL_WINDOW_OVERLAY_PORTAL and share the same
    // useOverlayZIndex stack. The hardware DialogContainer remounts on every
    // atom action transition, so its Sheet.Overlay can end up above this
    // dialog's Frame on iOS and intercept taps even though the wallet-type
    // buttons appear visually on top. skipDeviceCancel:true keeps the BLE
    // session alive; the hardware dialog naturally returns when the SDK
    // emits its next UI event.
    // OK-59934: the DeviceStage lives in its own portal, never remounts
    // per action and never intercepts taps, so this dismiss-and-wait is
    // not needed for it (and would break the burst holding the flow). It
    // stays for the legacy surface until the cleanup pass.
    if (platformEnv.isNativeIOS && isLegacyHardwareUiActive()) {
      await hardwareUiStateDialogLifecycle.closeAndWait(() =>
        backgroundApiProxy.serviceHardwareUI.closeHardwareUiStateDialog({
          connectId: undefined,
          skipDeviceCancel: true,
          skipDelayClose: true,
          reason: 'open SelectAddWalletTypeDialog',
        }),
      );
    }

    return new Promise((resolve) => {
      const onCloseFn = async () => {
        setIsLoading(false);
        resolve(undefined);
      };

      setIsLoading(true);

      const selectAddWalletTypeDialog = Dialog.show({
        tone: 'success',
        icon: 'DocumentSearch2Outline',
        title: ' ',
        description: ' ',
        dismissOnOverlayPress: false,
        showFooter: false,
        renderContent: (
          <SelectAddWalletTypeDialogContent
            onAddStandardWalletPress={() => {
              void selectAddWalletTypeDialog.close();
              resolve('Standard');
            }}
            onAddHiddenWalletPress={() => {
              void selectAddWalletTypeDialog.close();
              resolve('Hidden');
            }}
          />
        ),
        onCancel: onCloseFn,
        onClose: onCloseFn,
      });
    });
  }, []);
  return {
    showSelectAddWalletTypeDialog,
    isLoading,
  };
}
