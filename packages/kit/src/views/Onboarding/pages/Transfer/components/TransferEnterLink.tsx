import { useState } from 'react';

import {
  Button,
  Divider,
  Input,
  SizableText,
  Stack,
  YStack,
  useClipboard,
} from '@onekeyhq/components';
import useScanQrCode from '@onekeyhq/kit/src/views/ScanQrCode/hooks/useScanQrCode';

import { TransferSteps } from './TransferSteps';

export function TransferEnterLink() {
  const { start } = useScanQrCode();
  const [address, setAddress] = useState('');
  const { onPasteClearText } = useClipboard();

  return (
    <Stack gap="$4">
      <YStack gap="$1">
        <SizableText size="$bodyMdMedium">Link</SizableText>

        <Input
          size="large"
          value={address}
          onChangeText={setAddress}
          onPaste={onPasteClearText}
          placeholder="192.168.X.XX:XXXXX/XXXX"
          addOns={[
            {
              iconName: 'ClipboardOutline',
              onPress: () => {
                console.log('clicked');
              },
            },
            {
              iconName: 'ScanOutline',
              onPress: async () => {
                const result = await start({
                  handlers: [],
                  autoHandleResult: false,
                });
                setAddress(result?.raw);
              },
            },
          ]}
        />

        <SizableText size="$bodyMd" color="$textSubdued">
          Paste the address from the QR code below on another device into this
          field.
        </SizableText>
      </YStack>

      <Stack>
        <Button variant="primary">Connect</Button>
      </Stack>

      <TransferSteps />

      <Divider />

      <SizableText size="$bodySm" color="$textSubdued">
        OneKey doesn't back up hardware wallets, please record and safeguard
        your recovery phrase.
      </SizableText>
    </Stack>
  );
}
