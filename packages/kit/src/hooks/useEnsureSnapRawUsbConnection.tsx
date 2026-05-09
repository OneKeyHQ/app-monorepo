import { useCallback } from 'react';

import { Dialog, SizableText, Stack, useClipboard } from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

const DEFAULT_SNAP_RAW_USB_CONNECT_COMMAND =
  'sudo snap connect onekey-wallet:raw-usb';

export function useEnsureSnapRawUsbConnection() {
  const { copyText } = useClipboard();

  const showRawUsbPermissionDialog = useCallback(
    (command = DEFAULT_SNAP_RAW_USB_CONNECT_COMMAND) => {
      Dialog.show({
        icon: 'UsbOutline',
        title: 'USB permission required',
        description: (
          <Stack gap="$3">
            <SizableText size="$bodyMd" color="$textSubdued">
              OneKey Wallet needs raw USB permission before WebUSB can access
              your hardware wallet. Run this command in Terminal, then try
              again.
            </SizableText>
            <Stack
              px="$3"
              py="$2.5"
              borderRadius="$2"
              bg="$bgSubdued"
              borderWidth="$px"
              borderColor="$borderSubdued"
            >
              <SizableText size="$bodyMd" fontFamily="$monoRegular" selectable>
                {command}
              </SizableText>
            </Stack>
          </Stack>
        ),
        onCancelText: 'Got it',
        onConfirmText: 'Copy command',
        onConfirm: () => {
          copyText(command);
        },
      });
    },
    [copyText],
  );

  return useCallback(async () => {
    if (!platformEnv.isDesktopLinuxSnap) {
      return true;
    }

    try {
      const status =
        await globalThis.desktopApiProxy?.system?.checkSnapRawUsbConnection?.();
      if (!status?.isSnap || status.connected) {
        return true;
      }
      showRawUsbPermissionDialog(status.command);
      return false;
    } catch (error) {
      console.error('checkSnapRawUsbConnection failed:', error);
      showRawUsbPermissionDialog();
      return false;
    }
  }, [showRawUsbPermissionDialog]);
}
