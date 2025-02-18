import { useState } from 'react';

import {
  Button,
  Input,
  SizableText,
  YStack,
  useClipboard,
} from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import useScanQrCode from '@onekeyhq/kit/src/views/ScanQrCode/hooks/useScanQrCode';
import { EOnboardingPages } from '@onekeyhq/shared/src/routes';

export function TransferEnterLink() {
  const navigation = useAppNavigation();

  const { start } = useScanQrCode();
  const [address, setAddress] = useState('');
  const { onPasteClearText } = useClipboard();

  return (
    <>
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

      <Button
        onPress={() => {
          navigation.push(EOnboardingPages.TransferData);
        }}
        variant="primary"
      >
        Connect
      </Button>
    </>
  );
}
