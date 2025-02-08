import {
  SizableText,
  YStack,
  XStack,
  Image,
  Icon,
  Divider,
} from '@onekeyhq/components';
import { TransferSteps } from './TransferSteps';

export function TransferQrCode() {
  return (
    <YStack gap="$6">
      <YStack gap="$6">
        <Image width={100} height={100} />

        <XStack gap="$2">
          <Icon name="Link2Solid" size={24} />
          <SizableText>192.168.5.178:2997</SizableText>
        </XStack>
      </YStack>

      <TransferSteps />

      <Divider />

      <SizableText size="$bodySm" color="$textSubdued">
        OneKey doesn't back up hardware wallets, please record and safeguard
        your recovery phrase.
      </SizableText>
    </YStack>
  );
}
