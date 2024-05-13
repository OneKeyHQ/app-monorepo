import { useCallback } from 'react';

import { useThrottledCallback } from 'use-debounce';

import { Dialog } from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import {
  EModalFirmwareUpdateRoutes,
  EModalRoutes,
  ERootRoutes,
} from '@onekeyhq/shared/src/routes';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import useAppNavigation from '../../../hooks/useAppNavigation';

export function useFirmwareUpdateActions() {
  const navigation = useAppNavigation();

  const openChangeLogOfExtension = useThrottledCallback(
    async (params: { connectId: string | undefined }) =>
      backgroundApiProxy.serviceApp.openExtensionExpandTab({
        routes: [
          ERootRoutes.Modal,
          EModalRoutes.FirmwareUpdateModal,
          EModalFirmwareUpdateRoutes.ChangeLog,
        ],
        params,
      }),
    1000,
    {
      leading: true,
      trailing: false,
    },
  );

  const openChangeLog = useCallback(
    ({ connectId }: { connectId: string | undefined }) => {
      if (platformEnv.isExtensionUiPopup) {
        void openChangeLogOfExtension({ connectId });
        return;
      }
      navigation.push(EModalFirmwareUpdateRoutes.ChangeLog, {
        connectId,
      });
    },
    [navigation, openChangeLogOfExtension],
  );

  const openChangeLogModal = useCallback(
    ({ connectId }: { connectId: string | undefined }) => {
      if (platformEnv.isExtensionUiPopup) {
        void openChangeLogOfExtension({ connectId });
        return;
      }
      navigation.pushModal(EModalRoutes.FirmwareUpdateModal, {
        screen: EModalFirmwareUpdateRoutes.ChangeLog,
        params: {
          connectId,
        },
      });
    },
    [navigation, openChangeLogOfExtension],
  );

  const closeUpdateModal = useCallback(() => {
    navigation.popStack();
  }, [navigation]);

  const showBootloaderMode = useCallback(
    ({ connectId }: { connectId: string | undefined }) => {
      Dialog.show({
        title: 'Device in bootloader mode',
        description:
          'Your hardware wallet is in bootloader mode, which is used for software updates. Would you like to update now? If you prefer not to update, please manually restart the device to return to normal mode.',
        dismissOnOverlayPress: false,
        onConfirm: async () => {
          openChangeLogModal({ connectId });
        },
        onConfirmText: 'Update now',
      });
    },
    [openChangeLogModal],
  );

  const showForceUpdate = useCallback(
    ({ connectId }: { connectId: string | undefined }) => {
      Dialog.show({
        title: 'Update required',
        description:
          "Your hardware wallet's version is outdated and must be updated to continue.",
        dismissOnOverlayPress: false,
        onConfirm: async () => {
          openChangeLogModal({ connectId });
        },
        onConfirmText: 'Update now',
      });
    },
    [openChangeLogModal],
  );

  return {
    closeUpdateModal,
    openChangeLog,
    openChangeLogModal,
    openChangeLogOfExtension,
    showBootloaderMode,
    showForceUpdate,
  };
}
