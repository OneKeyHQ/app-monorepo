import { useCallback, useState } from 'react';

import { useIntl } from 'react-intl';

import { Button, Stack } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromptWebDeviceAccess } from '@onekeyhq/kit/src/hooks/usePromptWebDeviceAccess';
import type { IFirmwareUpdateStepInfo } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { useFirmwareUpdateStepInfoAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';

export function FirmwareUpdatePromptWebUsbDevice({
  previousStepInfo,
  requestType = 'bootloader',
}: {
  previousStepInfo: IFirmwareUpdateStepInfo | undefined;
  requestType?: 'bootloader' | 'switchFirmware';
}) {
  const intl = useIntl();
  const [isConnecting, setIsConnecting] = useState(false);
  const { promptWebUsbDeviceAccess } = usePromptWebDeviceAccess();
  const [_, setStepInfo] = useFirmwareUpdateStepInfoAtom();

  // Handle USB connection request
  const handleGrantAccess = useCallback(async () => {
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

  return (
    <Stack alignItems="center" justifyContent="flex-start">
      <Button
        alignSelf="flex-start"
        variant="primary"
        size="medium"
        loading={isConnecting}
        disabled={isConnecting}
        onPress={handleGrantAccess}
      >
        {intl.formatMessage({ id: ETranslations.device_grant_usb_access })}
      </Button>
    </Stack>
  );
}
