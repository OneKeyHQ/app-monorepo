import { useCallback } from 'react';

import { Button, SizableText, XStack, YStack } from '@onekeyhq/components';
import { Token } from '@onekeyhq/kit/src/components/Token';
import { openUrlExternal } from '@onekeyhq/shared/src/utils/openUrlUtils';

type IProtocolIntroProps = {
  protocolLogoUrl: string;
  protocolText: string;
  externalUrl: string;
};

export const ProtocolIntro = ({
  protocolLogoUrl,
  protocolText,
  externalUrl,
}: IProtocolIntroProps) => {
  const onPress = useCallback(() => {
    openUrlExternal(externalUrl);
  }, [externalUrl]);
  return (
    <YStack mt="$12">
      <SizableText size="$headingLg">Info</SizableText>
      <XStack mt="$5">
        <YStack flex={1}>
          <SizableText color="$textSubdued" size="$bodyMd" mb="$1">
            Protocol
          </SizableText>
          <XStack alignItems="center">
            <Token size="xs" tokenImageUri={protocolLogoUrl} />
            <SizableText px="$1" size="$bodyLgMedium" />
            <Button
              iconAfter="OpenOutline"
              variant="tertiary"
              size="medium"
              color="$text"
              onPress={onPress}
            >
              {protocolText}
            </Button>
          </XStack>
        </YStack>
        <YStack flex={1}>
          <SizableText color="$textSubdued" size="$bodyMd" mb="$1">
            Network
          </SizableText>
          <SizableText size="$bodyLgMedium">Ethereum</SizableText>
        </YStack>
      </XStack>
    </YStack>
  );
};
