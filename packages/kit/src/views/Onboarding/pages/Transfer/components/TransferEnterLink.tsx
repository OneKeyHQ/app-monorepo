import { useState } from 'react';

import {
  Button,
  Divider,
  Input,
  SizableText,
  Stack,
  useClipboard,
  YStack,
} from '@onekeyhq/components';

import { TransferSteps } from './TransferSteps';
import useScanQrCode from '../../../../ScanQrCode/hooks/useScanQrCode';

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
                const address = await start({
                  handlers: [],
                  autoHandleResult: false,
                });
                setAddress(address?.raw);
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
