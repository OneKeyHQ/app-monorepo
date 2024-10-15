import { useCallback } from 'react';

import { StackActions } from '@react-navigation/routers';
import { useIntl } from 'react-intl';
import { useThrottledCallback } from 'use-debounce';

import { Dialog, rootNavigationRef } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import {
  EModalFirmwareUpdateRoutes,
  EModalRoutes,
  ERootRoutes,
} from '@onekeyhq/shared/src/routes';
import type { ICheckAllFirmwareReleaseResult } from '@onekeyhq/shared/types/device';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import useAppNavigation from '../../../hooks/useAppNavigation';
import { FirmwareUpdateCheckList } from '../components/FirmwareUpdateCheckList';

export function useFirmwareUpdateActions() {
  const intl = useIntl();
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

  /*
  $$appEventBus.emit('ShowFirmwareUpdateForce',{ connectId: '3383' })
  */
  const openChangeLogModal = useCallback(
    ({ connectId }: { connectId: string | undefined }) => {
      if (platformEnv.isExtensionUiPopup) {
        void openChangeLogOfExtension({ connectId });
        return;
      }

      if (rootNavigationRef.current) {
        rootNavigationRef.current?.dispatch(
          StackActions.push(ERootRoutes.Modal, {
            screen: EModalRoutes.FirmwareUpdateModal,
            params: {
              screen: EModalFirmwareUpdateRoutes.ChangeLog,
              params: {
                connectId,
              },
            },
          }),
        );
      } else {
        // **** navigation.pushModal not working when Dialog open
        navigation.pushModal(EModalRoutes.FirmwareUpdateModal, {
          screen: EModalFirmwareUpdateRoutes.ChangeLog,
          params: {
            connectId,
          },
        });
      }
    },
    [navigation, openChangeLogOfExtension],
  );

  const closeUpdateModal = useCallback(() => {
    navigation.popStack();
  }, [navigation]);

  const showBootloaderMode = useCallback(
    ({
      connectId,
      existsFirmware,
    }: {
      connectId: string | undefined;
      existsFirmware?: boolean;
    }) => {
      if (existsFirmware) {
        Dialog.show({
          title: intl.formatMessage({
            id: ETranslations.update_device_in_bootloader_mode,
          }),
          description: intl.formatMessage({
            id: ETranslations.update_hardware_wallet_in_bootloader_mode_restart,
          }),
          dismissOnOverlayPress: false,
          onConfirm: async ({ close }) => {
            void close?.();
          },
          onConfirmText: intl.formatMessage({
            id: ETranslations.global_got_it,
          }),
          onCancel: async () => {
            openChangeLogModal({ connectId });
          },
          onCancelText: intl.formatMessage({
            id: ETranslations.update_update_now,
          }),
        });
      } else {
        Dialog.show({
          title: intl.formatMessage({
            id: ETranslations.update_device_in_bootloader_mode,
          }),
          description: intl.formatMessage({
            id: ETranslations.update_hardware_wallet_in_bootloader_mode,
          }),
          dismissOnOverlayPress: false,
          showCancelButton: false,
          onConfirm: async () => {
            openChangeLogModal({ connectId });
          },
          onConfirmText: intl.formatMessage({
            id: ETranslations.update_update_now,
          }),
        });
      }
    },
    [intl, openChangeLogModal],
  );

  const showForceUpdate = useCallback(
    ({ connectId }: { connectId: string | undefined }) => {
      Dialog.show({
        title: intl.formatMessage({ id: ETranslations.update_update_required }),
        description: intl.formatMessage({
          id: ETranslations.update_update_required_desc,
        }),
        dismissOnOverlayPress: false,
        onConfirm: async () => {
          openChangeLogModal({ connectId });
        },
        onConfirmText: intl.formatMessage({
          id: ETranslations.update_update_now,
        }),
      });
    },
    [intl, openChangeLogModal],
  );

  const showCheckList = useCallback(
    ({ result }: { result: ICheckAllFirmwareReleaseResult | undefined }) => {
      Dialog.confirm({
        title: intl.formatMessage({
          id: ETranslations.update_ready_to_upgrade_checklist,
        }),
        icon: 'ChecklistOutline',
        renderContent: <FirmwareUpdateCheckList result={result} />,
        onConfirmText: intl.formatMessage({
          id: ETranslations.global_continue,
        }),
      });
    },
    [intl],
  );

  return {
    closeUpdateModal,
    openChangeLog,
    openChangeLogModal,
    openChangeLogOfExtension,
    showBootloaderMode,
    showForceUpdate,
    showCheckList,
  };
}
