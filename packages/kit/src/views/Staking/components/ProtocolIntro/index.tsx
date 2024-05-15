import { SizableText, XStack, YStack } from '@onekeyhq/components';
import { Token } from '@onekeyhq/kit/src/components/Token';

type IProtocolIntroProps = {
  protocolLogoUrl: string;
  protocolText: string;
};

export const ProtocolIntro = ({
  protocolLogoUrl,
  protocolText,
}: IProtocolIntroProps) => (
  <YStack mt="$12">
    <SizableText size="$headingLg">Info</SizableText>
    <XStack mt="$5">
      <YStack w="50%">
        <SizableText color="$textSubdued" size="$bodyMd" mb="$1">
          Protocol
        </SizableText>
        <XStack space="$1" alignItems="center">
          <Token size="xs" tokenImageUri={protocolLogoUrl} />
          <SizableText size="$bodyLgMedium">{protocolText}</SizableText>
        </XStack>
      </YStack>
      <YStack w="50%">
        <SizableText color="$textSubdued" size="$bodyMd" mb="$1">
          Network
        </SizableText>
        <SizableText size="$bodyLgMedium">Ethereum</SizableText>
      </YStack>
    </XStack>
  </YStack>
);
