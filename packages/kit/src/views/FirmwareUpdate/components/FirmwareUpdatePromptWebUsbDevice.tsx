import { useCallback, useState } from 'react';

import { useIntl } from 'react-intl';

import { Button, Stack } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromptWebDeviceAccess } from '@onekeyhq/kit/src/hooks/usePromptWebDeviceAccess';
import type { IFirmwareUpdateStepInfo } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { useFirmwareUpdateStepInfoAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { FirmwareUpdateTestIDs } from '../testIDs';

/**
 * WebUSB must be re-granted after the device re-enumerates (bootloader PID,
 * firmware type switch). Shared by the legacy prompt and the install page.
 */
export function useGrantWebUsbAccess({
  previousStepInfo,
  requestType = 'bootloader',
}: {
  previousStepInfo: IFirmwareUpdateStepInfo | undefined;
  requestType?: 'bootloader' | 'switchFirmware';
}) {
  const [isConnecting, setIsConnecting] = useState(false);
  const { promptWebUsbDeviceAccess } = usePromptWebDeviceAccess();
  const [_, setStepInfo] = useFirmwareUpdateStepInfoAtom();

  // Handle USB connection request
  const grantAccess = useCallback(async () => {
    setIsConnecting(true);
    try {
      const device = await promptWebUsbDeviceAccess();
      if (requestType === 'switchFirmware') {
        await backgroundApiProxy.serviceHardwareUI.sendRequestDeviceForSwitchFirmwareWebDevice(
          {
            deviceId: device.serialNumber ?? '',
          },
        );
      } else {
        await backgroundApiProxy.serviceHardwareUI.sendRequestDeviceInBootloaderForWebDevice(
          {
            deviceId: device.serialNumber ?? '',
          },
        );
      }
      if (previousStepInfo) {
        setStepInfo({
          ...previousStepInfo,
        } as IFirmwareUpdateStepInfo);
      }
    } catch (error) {
      console.error('USB device connection failed:', error);
    } finally {
      setIsConnecting(false);
    }
  }, [promptWebUsbDeviceAccess, requestType, setStepInfo, previousStepInfo]);

  return { grantAccess, isConnecting };
}

export function FirmwareUpdatePromptWebUsbDevice({
  previousStepInfo,
  requestType = 'bootloader',
}: {
  previousStepInfo: IFirmwareUpdateStepInfo | undefined;
  requestType?: 'bootloader' | 'switchFirmware';
}) {
  const intl = useIntl();
  const { grantAccess: handleGrantAccess, isConnecting } = useGrantWebUsbAccess(
    { previousStepInfo, requestType },
  );

  return (
    <Stack alignItems="center" justifyContent="flex-start">
      <Button
        alignSelf="flex-start"
        variant="primary"
        size="medium"
        loading={isConnecting}
        disabled={isConnecting}
        onPress={handleGrantAccess}
        testID={FirmwareUpdateTestIDs.grantUsbAccessBtn}
      >
        {intl.formatMessage({ id: ETranslations.device_grant_usb_access })}
      </Button>
    </Stack>
  );
}
