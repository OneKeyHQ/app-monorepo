import { useCallback } from 'react';

import { HardwareErrorCode } from '@onekeyfe/hd-shared';
import { isNil } from 'lodash';
import { useIntl } from 'react-intl';

import { Dialog } from '@onekeyhq/components';
import type { IOneKeyError } from '@onekeyhq/shared/src/errors/types/errorTypes';
import { isHardwareErrorByCode } from '@onekeyhq/shared/src/errors/utils/deviceErrorUtils';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { isProtocolV2ProductType } from '@onekeyhq/shared/src/utils/hardwareDeviceTypes';
import type { EHardwareTransportType } from '@onekeyhq/shared/types';
import type { IOneKeyDeviceFeatures } from '@onekeyhq/shared/types/device';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { getFirmwareUpdateUSBPreflightParams } from '../../FirmwareUpdate/utils';
import { getDesktopForceUSBTransportType } from '../utils';

import type { SearchDevice } from '@onekeyfe/hd-core';

export interface IUSBConnectPrepareResult {
  connectId: string;
  originalTransport?: EHardwareTransportType;
  needsRestore: boolean;
}

// Singleton: Store original transport type across all hook instances
// This ensures transport can be restored correctly even if user exits during firmware update
let globalOriginalTransport: EHardwareTransportType | undefined;

export function usePrepareUSBConnectForFirmwareUpdate() {
  const intl = useIntl();
  const prepareUSBConnect = useCallback(
    async ({
      device,
      features,
    }: {
      device: SearchDevice;
      features: IOneKeyDeviceFeatures | undefined;
    }): Promise<IUSBConnectPrepareResult | null> => {
      let usbPreflightParams: Awaited<
        ReturnType<typeof getFirmwareUpdateUSBPreflightParams>
      > = {
        connectId: device.connectId ?? undefined,
        connectProtocol: isProtocolV2ProductType(device.deviceType)
          ? 'V2'
          : undefined,
      };
      if (platformEnv.isDesktop) {
        try {
          usbPreflightParams = await getFirmwareUpdateUSBPreflightParams({
            features,
            deviceType: device.deviceType,
            originalConnectId: device.connectId ?? undefined,
          });
        } catch (error) {
          console.error('Failed to build USB connectId:', error);
        }
      }
      const { connectId: connectIdToUse, connectProtocol } = usbPreflightParams;

      // Step 1: Check if USB device is available
      let isUSBDeviceAvailable: boolean;
      try {
        isUSBDeviceAvailable =
          await backgroundApiProxy.serviceHardware.detectUSBDeviceAvailability(
            usbPreflightParams,
          );
      } catch (error) {
        if (
          !isHardwareErrorByCode({
            error: error as IOneKeyError,
            code: HardwareErrorCode.FirmwareUpdateLimitOneDevice,
          })
        ) {
          throw error;
        }
        Dialog.show({
          icon: 'TypeCoutline',
          title: intl.formatMessage({
            id: ETranslations.firmware_update_install_page__title,
          }),
          description: intl.formatMessage({
            id: ETranslations.update_only_one_usb_device_supported_for_upgrade,
          }),
          onConfirmText: intl.formatMessage({
            id: ETranslations.global_got_it,
          }),
          showCancelButton: false,
        });
        return null;
      }

      if (!isUSBDeviceAvailable) {
        Dialog.show({
          icon: 'TypeCoutline',
          title: intl.formatMessage({
            id: ETranslations.upgrade_use_usb,
          }),
          description: intl.formatMessage({
            id: ETranslations.upgrade_recommend_usb,
          }),
          onConfirmText: intl.formatMessage({
            id: ETranslations.global_got_it,
          }),
          showCancelButton: false,
        });
        return null;
      }

      // Step 2: For Desktop, switch to USB transport type
      if (platformEnv.isDesktop) {
        const desktopForceUSBTransportType =
          await getDesktopForceUSBTransportType({ connectProtocol });
        if (desktopForceUSBTransportType) {
          globalOriginalTransport =
            await backgroundApiProxy.serviceHardware.getCurrentForceTransportType();
          await backgroundApiProxy.serviceHardware.setForceTransportType({
            forceTransportType: desktopForceUSBTransportType,
          });
        }
      }

      if (isNil(connectIdToUse)) {
        return null;
      }

      return {
        connectId: connectIdToUse,
        originalTransport: globalOriginalTransport,
        needsRestore: globalOriginalTransport !== undefined,
      };
    },
    [intl],
  );

  /**
   * Restore original transport type after firmware update
   */
  const restoreOriginalTransport = useCallback(async () => {
    const savedTransport = globalOriginalTransport;
    if (savedTransport !== undefined) {
      await backgroundApiProxy.serviceHardware.setForceTransportType({
        forceTransportType: savedTransport,
      });
      globalOriginalTransport = undefined;
    }
  }, []);

  return {
    prepareUSBConnect,
    restoreOriginalTransport,
  };
}
