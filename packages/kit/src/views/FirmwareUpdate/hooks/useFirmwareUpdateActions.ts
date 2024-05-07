import { useCallback } from 'react';

import { Dialog } from '@onekeyhq/components';
import {
  EModalFirmwareUpdateRoutes,
  EModalRoutes,
  ERootRoutes,
} from '@onekeyhq/shared/src/routes';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import useAppNavigation from '../../../hooks/useAppNavigation';

export function useFirmwareUpdateActions() {
  const navigation = useAppNavigation();

  const openChangeLog = useCallback(
    ({ connectId }: { connectId: string | undefined }) => {
      navigation.push(EModalFirmwareUpdateRoutes.ChangeLog, {
        connectId,
      });
    },
    [navigation],
  );

  const openChangeLogModal = useCallback(
    ({ connectId }: { connectId: string | undefined }) => {
      navigation.pushModal(EModalRoutes.FirmwareUpdateModal, {
        screen: EModalFirmwareUpdateRoutes.ChangeLog,
        params: {
          connectId,
        },
      });
    },
    [navigation],
  );

  const openChangeLogOfExtension = useCallback(
    async (params: { connectId: string | undefined }) =>
      backgroundApiProxy.serviceApp.openExtensionExpandTab({
        routes: [
          ERootRoutes.Modal,
          EModalRoutes.FirmwareUpdateModal,
          EModalFirmwareUpdateRoutes.ChangeLog,
        ],
        params,
      }),
    [],
  );

  const showBootloaderMode = useCallback(() => {
    Dialog.show({
      title: 'Device in bootloader mode',
      description:
        'Your hardware wallet is in bootloader mode, which is used for software updates. Would you like to update now? If you prefer not to update, please manually restart the device to return to normal mode.',
      dismissOnOverlayPress: false,
      onConfirm: async () => {
        openChangeLogModal({ connectId: undefined });
      },
      onConfirmText: 'Update',
    });
  }, [openChangeLogModal]);

  const showForceUpdate = useCallback(
    ({ connectId }: { connectId: string | undefined }) => {
      Dialog.show({
        title: 'Fireamware Update Required',
        description: 'Fireamware Update Required',
        dismissOnOverlayPress: false,
        onConfirm: async () => {
          openChangeLogModal({ connectId });
        },
        onConfirmText: 'Update',
      });
    },
    [openChangeLogModal],
  );

  return {
    openChangeLog,
    openChangeLogModal,
    openChangeLogOfExtension,
    showBootloaderMode,
    showForceUpdate,
  };
}
