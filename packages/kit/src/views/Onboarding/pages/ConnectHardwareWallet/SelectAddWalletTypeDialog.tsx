import { useCallback, useState } from 'react';

import { useIntl } from 'react-intl';

import { Dialog, YStack } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { hardwareUiStateDialogLifecycle } from '@onekeyhq/kit/src/provider/Container/HardwareUiStateContainer/hardwareUiStateDialogLifecycle';
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
    // iOS-only: wait until the hardware Sheet has left the main runtime's
    // FullWindowOverlay before mounting another Sheet. The background atom
    // write can finish before the main runtime commits the close, so a fixed
    // delay can still leave the old overlay intercepting touches.
    // OK-59934: the DeviceStage is not the legacy DialogContainer — it does
    // not remount per action and never steals taps, so the close-and-wait
    // below (which would also break the burst) is only for the old surface.
    const deviceStageEnabled =
      await backgroundApiProxy.serviceHardwareUI.isDeviceStageEnabled();
    if (platformEnv.isNativeIOS && !deviceStageEnabled) {
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
