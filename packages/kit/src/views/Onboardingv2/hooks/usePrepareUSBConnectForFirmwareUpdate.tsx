import { useCallback } from 'react';

import { isNil } from 'lodash';
import { useIntl } from 'react-intl';

import { Dialog } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import deviceUtils from '@onekeyhq/shared/src/utils/deviceUtils';
import { EHardwareTransportType } from '@onekeyhq/shared/types';
import type { IOneKeyDeviceFeatures } from '@onekeyhq/shared/types/device';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
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
      // Step 1: Check if USB device is available
      const isUSBDeviceAvailable =
        await backgroundApiProxy.serviceHardware.detectUSBDeviceAvailability();

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
          await getDesktopForceUSBTransportType();
        if (desktopForceUSBTransportType) {
          globalOriginalTransport =
            await backgroundApiProxy.serviceHardware.getCurrentForceTransportType();
          await backgroundApiProxy.serviceHardware.setForceTransportType({
            forceTransportType: desktopForceUSBTransportType,
          });
        }
      }

      // Step 3: Build USB connectId from BLE connection if needed
      let connectIdToUse = device.connectId;
      if (
        platformEnv.isDesktop &&
        globalOriginalTransport === EHardwareTransportType.DesktopWebBle &&
        features
      ) {
        try {
          const usbConnectId = await deviceUtils.buildDeviceUSBConnectId({
            features,
          });
          if (!isNil(usbConnectId)) {
            connectIdToUse = usbConnectId;
          }
        } catch (error) {
          console.error('Failed to build USB connectId:', error);
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
