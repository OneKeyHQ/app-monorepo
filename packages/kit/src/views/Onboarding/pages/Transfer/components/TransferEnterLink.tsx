import { useState } from 'react';

import {
  Button,
  Divider,
  Input,
  SizableText,
  Stack,
  YStack,
} from '@onekeyhq/components';

import { TransferSteps } from './TransferSteps';

export function TransferEnterLink() {
  const [value, setValue] = useState('');

  return (
    <YStack gap="$4">
      <YStack gap="$1">
        <SizableText size="$bodyMdMedium">Link</SizableText>

        <Input
          size="large"
          value={value}
          onChangeText={setValue}
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
              onPress: () => {
                console.log('clicked');
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
    </YStack>
  );
}
