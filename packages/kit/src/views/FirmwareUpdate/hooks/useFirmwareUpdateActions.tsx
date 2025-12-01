import { useCallback } from 'react';

import { EFirmwareType } from '@onekeyfe/hd-shared';
import { StackActions } from '@react-navigation/routers';
import { useIntl } from 'react-intl';
import { useThrottledCallback } from 'use-debounce';

import { Dialog, rootNavigationRef } from '@onekeyhq/components';
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
import { closeModalPages } from '../../../hooks/usePageNavigation';
import { FirmwareUpdateCheckList } from '../components/FirmwareUpdateCheckList';

import type { AllFirmwareRelease } from '@onekeyfe/hd-core';
import type { EDeviceType } from '@onekeyfe/hd-shared';

export function useFirmwareUpdateActions() {
  const intl = useIntl();
  const navigation = useAppNavigation();

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
    ({
      connectId,
      firmwareType,
      baseReleaseInfo,
    }: {
      connectId: string | undefined;
      firmwareType?: EFirmwareType;
      baseReleaseInfo?: AllFirmwareRelease;
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

      if (rootNavigationRef.current) {
        rootNavigationRef.current?.dispatch(
          StackActions.push(ERootRoutes.Modal, {
            screen: EModalRoutes.FirmwareUpdateModal,
            params: {
              screen: EModalFirmwareUpdateRoutes.ChangeLog,
              params: {
                connectId,
                firmwareType,
                baseReleaseInfo,
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
            firmwareType,
            baseReleaseInfo,
          },
        });
      }
    },
    [navigation, openChangeLogOfExtension],
  );

  const closeUpdateModal = useCallback(() => {
    navigation.popStack();
  }, [navigation]);

  const restartOnboarding = useCallback(
    async ({ deviceType }: { deviceType: EDeviceType | undefined }) => {
      await closeModalPages();
      rootNavigationRef.current?.navigate(ERootRoutes.Onboarding, {
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
    }: {
      connectId: string | undefined;
      existsFirmware?: boolean;
      onBeforeUpdate?: () => Promise<string | undefined>;
    }) => {
      const handleUpdateClick = async () => {
        // Call onBeforeUpdate callback if provided (for onboarding USB preparation)
        const finalConnectId = onBeforeUpdate
          ? await onBeforeUpdate()
          : connectId;

        // Only open modal if USB preparation succeeded (finalConnectId is defined)
        // If undefined, it means USB is not available and a dialog was already shown
        if (finalConnectId !== undefined) {
          openChangeLogModal({ connectId: finalConnectId });
        }
      };

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
            await handleUpdateClick();
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
            await handleUpdateClick();
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
      let title;

      const updateFirmwareInfo = result?.updateInfos?.firmware;
      if (
        updateFirmwareInfo &&
        updateFirmwareInfo?.fromFirmwareType &&
        updateFirmwareInfo?.toFirmwareType &&
        updateFirmwareInfo.toFirmwareType !==
          updateFirmwareInfo.fromFirmwareType &&
        updateFirmwareInfo.toFirmwareType === EFirmwareType.BitcoinOnly
      ) {
        title = intl.formatMessage(
          {
            id: ETranslations.device_checklist_switch_firmware_type,
          },
          {
            type: 'Bitcoin-only',
          },
        );
      } else if (
        updateFirmwareInfo &&
        updateFirmwareInfo?.fromFirmwareType &&
        updateFirmwareInfo?.toFirmwareType &&
        updateFirmwareInfo.toFirmwareType !==
          updateFirmwareInfo.fromFirmwareType &&
        updateFirmwareInfo.toFirmwareType === EFirmwareType.Universal
      ) {
        title = intl.formatMessage(
          {
            id: ETranslations.device_checklist_switch_firmware_type,
          },
          {
            type: 'Universal',
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
    restartOnboarding,
  };
}
