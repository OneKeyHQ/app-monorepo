import { useCallback, useEffect, useRef } from 'react';

import {
  type EDeviceType,
  type EFirmwareType,
  HardwareErrorCode,
} from '@onekeyfe/hd-shared';
import { StackActions } from '@react-navigation/routers';
import { useIntl } from 'react-intl';
import { useThrottledCallback } from 'use-debounce';

import type { IDialogInstance } from '@onekeyhq/components';
import {
  Dialog,
  resetModalRouteByName,
  resetToRoute,
  rootNavigationRef,
} from '@onekeyhq/components';
import type { IOneKeyError } from '@onekeyhq/shared/src/errors/types/errorTypes';
import { isHardwareErrorByCode } from '@onekeyhq/shared/src/errors/utils/deviceErrorUtils';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import {
  EModalFirmwareUpdateRoutes,
  EModalRoutes,
  EOnboardingPagesV2,
  EOnboardingV2Routes,
  ERootRoutes,
} from '@onekeyhq/shared/src/routes';
import type { ICheckAllFirmwareReleaseResult } from '@onekeyhq/shared/types/device';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import useAppNavigation from '../../../hooks/useAppNavigation';
import { FirmwareUpdateCheckList } from '../components/FirmwareUpdateCheckList';
import { shouldSuggestDesktopUsbFirmwareUpdate } from '../firmwareUpdateTransportUtils';
import { FirmwareUpdateTestIDs } from '../testIDs';
import { getTargetFirmwareTypeLabel } from '../utils';

import { bootloaderModeDialogManager } from './bootloaderModeDialogManager';

import type { AllFirmwareRelease, IDeviceType } from '@onekeyfe/hd-core';

export type IBootloaderModeDialogHost = Pick<typeof Dialog, 'show'>;

/**
 * The "desktop USB is faster" suggestion for models that update slowly over
 * Bluetooth. The calling component owns the dialog: it closes with it.
 */
function useDesktopUsbSuggestion() {
  const intl = useIntl();
  const isOpenRef = useRef(false);
  const dialogRef = useRef<IDialogInstance | undefined>(undefined);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      // The suggestion lives in the global overlay, so it would otherwise
      // stay on top of whatever replaces its page.
      void dialogRef.current?.close();
    };
  }, []);

  // Resolves true only when the user chooses to keep updating via Bluetooth.
  return useCallback(async () => {
    // Callers are button handlers that nothing waits for, so a second tap
    // must not stack another suggestion on the one already open.
    if (isOpenRef.current) {
      return false;
    }
    isOpenRef.current = true;
    try {
      const confirmed = await new Promise<boolean>((resolve) => {
        dialogRef.current = Dialog.show({
          icon: 'TypeCoutline',
          title: intl.formatMessage({
            id: ETranslations.firmware_update_install_page__title,
          }),
          description: intl.formatMessage({
            id: ETranslations.firmware_update_usb_recommended__desc,
          }),
          onConfirmText: intl.formatMessage({
            id: ETranslations.firmware_update_continue_via_bluetooth__action,
          }),
          confirmButtonProps: {
            testID: FirmwareUpdateTestIDs.usbSuggestionContinueBtn,
          },
          showCancelButton: false,
          // onClose runs once the sheet has left the overlay, so whatever the
          // caller opens next never mounts inside this dialog's exit window.
          // Only the confirm button closes with the 'confirm' flag.
          onClose: (extra) => {
            dialogRef.current = undefined;
            resolve(extra?.flag === 'confirm');
          },
        });
      });
      return confirmed && isMountedRef.current;
    } finally {
      isOpenRef.current = false;
    }
  }, [intl]);
}

export function useFirmwareUpdateActions() {
  const intl = useIntl();
  const navigation = useAppNavigation();
  const confirmUpdateViaBluetooth = useDesktopUsbSuggestion();

  const openChangeLogOfExtension = useThrottledCallback(
    async (params: {
      connectId: string | undefined;
      firmwareType: EFirmwareType | undefined;
      baseReleaseInfo?: AllFirmwareRelease;
    }) =>
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
      if (
        platformEnv.isExtensionUiPopup ||
        platformEnv.isExtensionUiSidePanel
      ) {
        void openChangeLogOfExtension({
          connectId,
          firmwareType: undefined,
        });
        if (platformEnv.isExtensionUiSidePanel) {
          window.close();
        }
        return;
      }
      navigation.push(EModalFirmwareUpdateRoutes.ChangeLog, {
        connectId,
        firmwareType: undefined,
      });
    },
    [navigation, openChangeLogOfExtension],
  );

  /*
  appGlobals.$$appEventBus.emit('ShowFirmwareUpdateForce',{ connectId: '3383' })
  */
  const openChangeLogModal = useCallback(
    async ({
      connectId,
      firmwareType,
      baseReleaseInfo,
      suggestDesktopUsbForDeviceType,
    }: {
      connectId: string | undefined;
      firmwareType?: EFirmwareType;
      baseReleaseInfo?: AllFirmwareRelease;
      /**
       * Passed by entries the user can reach without the device at hand, so
       * the desktop USB suggestion shows before any device communication.
       * Other entries leave it out and the changelog page asks instead.
       */
      suggestDesktopUsbForDeviceType?: IDeviceType;
    }) => {
      if (
        platformEnv.isExtensionUiPopup ||
        platformEnv.isExtensionUiSidePanel
      ) {
        void openChangeLogOfExtension({
          connectId,
          firmwareType,
          baseReleaseInfo,
        });
        if (platformEnv.isExtensionUiSidePanel) {
          window.close();
        }
        return;
      }

      let usbSuggestionAcknowledged = false;
      if (
        shouldSuggestDesktopUsbFirmwareUpdate({
          isNative: platformEnv.isNative,
          deviceType: suggestDesktopUsbForDeviceType,
        })
      ) {
        if (!(await confirmUpdateViaBluetooth())) {
          return;
        }
        usbSuggestionAcknowledged = true;
      }

      let resolvedConnectId = connectId;
      if (resolvedConnectId) {
        try {
          resolvedConnectId =
            await backgroundApiProxy.serviceHardware.checkDeviceReachableForFirmwareUpdate(
              { connectId: resolvedConnectId },
            );
        } catch (error) {
          if (
            !isHardwareErrorByCode({
              error: error as IOneKeyError,
              code: HardwareErrorCode.BleUnavailableWhileUsbConnected,
            })
          ) {
            return;
          }
        }
      }

      const changeLogParams = {
        connectId: resolvedConnectId,
        firmwareType,
        baseReleaseInfo,
        // Left out unless set: this route is also addressable by URL on web
        // and extension, where its params must stay as they were.
        ...(usbSuggestionAcknowledged ? { usbSuggestionAcknowledged } : {}),
      };
      if (rootNavigationRef.current) {
        rootNavigationRef.current?.dispatch(
          StackActions.push(ERootRoutes.Modal, {
            screen: EModalRoutes.FirmwareUpdateModal,
            params: {
              screen: EModalFirmwareUpdateRoutes.ChangeLog,
              params: changeLogParams,
            },
          }),
        );
      } else {
        // **** navigation.pushModal not working when Dialog open
        navigation.pushModal(EModalRoutes.FirmwareUpdateModal, {
          screen: EModalFirmwareUpdateRoutes.ChangeLog,
          params: changeLogParams,
        });
      }
    },
    [navigation, openChangeLogOfExtension, confirmUpdateViaBluetooth],
  );

  const closeUpdateModal = useCallback(() => {
    resetModalRouteByName(EModalRoutes.FirmwareUpdateModal);
  }, []);

  const restartOnboarding = useCallback(
    async ({ deviceType }: { deviceType: EDeviceType | undefined }) => {
      resetToRoute(ERootRoutes.Onboarding, {
        screen: EOnboardingV2Routes.OnboardingV2,
        params: {
          screen: EOnboardingPagesV2.ConnectYourDevice,
          params: {
            deviceType: [deviceType],
          },
        },
      });
    },
    [],
  );

  const showBootloaderMode = useCallback(
    ({
      connectId,
      existsFirmware,
      onBeforeUpdate,
      dialogHost = Dialog,
    }: {
      connectId: string | undefined;
      existsFirmware?: boolean;
      onBeforeUpdate?: () => Promise<string | undefined>;
      dialogHost?: IBootloaderModeDialogHost;
    }) => {
      const handleUpdateClick = async () => {
        // Call onBeforeUpdate callback if provided (for onboarding USB preparation)
        const finalConnectId = onBeforeUpdate
          ? await onBeforeUpdate()
          : connectId;

        // Only open modal if USB preparation succeeded (finalConnectId is defined)
        // If undefined, it means USB is not available and a dialog was already shown
        if (finalConnectId !== undefined) {
          await openChangeLogModal({ connectId: finalConnectId });
        }
      };

      if (existsFirmware) {
        bootloaderModeDialogManager.show({
          onUpdate: handleUpdateClick,
          createDialog: ({ onClose, onUpdate }) =>
            dialogHost.show({
              trackID: 'firmware-bootloader-mode-dialog',
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
              onCancel: onUpdate,
              onCancelText: intl.formatMessage({
                id: ETranslations.update_update_now,
              }),
              cancelButtonProps: {
                testID: 'firmware-bootloader-mode-update-btn',
              },
              onClose,
            }),
        });
      } else {
        bootloaderModeDialogManager.show({
          onUpdate: handleUpdateClick,
          createDialog: ({ onClose, onUpdate }) =>
            dialogHost.show({
              trackID: 'firmware-bootloader-mode-dialog',
              title: intl.formatMessage({
                id: ETranslations.update_device_in_bootloader_mode,
              }),
              description: intl.formatMessage({
                id: ETranslations.update_hardware_wallet_in_bootloader_mode,
              }),
              dismissOnOverlayPress: false,
              showCancelButton: false,
              onConfirm: onUpdate,
              onConfirmText: intl.formatMessage({
                id: ETranslations.update_update_now,
              }),
              confirmButtonProps: {
                testID: 'firmware-bootloader-mode-update-btn',
              },
              onClose,
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
          await openChangeLogModal({ connectId });
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
      let title;

      const updateFirmwareInfo = result?.updateInfos?.firmware;
      const isSwitchingFirmwareType =
        updateFirmwareInfo?.fromFirmwareType !== undefined &&
        updateFirmwareInfo?.toFirmwareType !== undefined &&
        updateFirmwareInfo.toFirmwareType !==
          updateFirmwareInfo.fromFirmwareType;
      if (isSwitchingFirmwareType) {
        title = intl.formatMessage(
          {
            id: ETranslations.device_checklist_switch_firmware_type,
          },
          {
            type: getTargetFirmwareTypeLabel({
              firmwareType: updateFirmwareInfo.toFirmwareType,
              intl,
            }),
          },
        );
      } else {
        title = intl.formatMessage({
          id: ETranslations.update_ready_to_upgrade_checklist,
        });
      }

      Dialog.confirm({
        title,
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
    confirmUpdateViaBluetooth,
    restartOnboarding,
  };
}
