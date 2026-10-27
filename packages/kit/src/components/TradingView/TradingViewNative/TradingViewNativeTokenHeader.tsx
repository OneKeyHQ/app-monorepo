import { SizableText, XStack } from '@onekeyhq/components';
import { Token } from '@onekeyhq/kit/src/components/Token';
import type { ITokenProps } from '@onekeyhq/kit/src/components/Token';

export function TradingViewNativeTokenHeader({
  name,
  tokenImageUri,
  tokenImageUris,
}: { name: string } & Pick<ITokenProps, 'tokenImageUri' | 'tokenImageUris'>) {
  return (
    <XStack
      testID="trading-view-native-fullscreen-token"
      alignItems="center"
      gap="$2"
      minWidth={0}
      maxWidth="$48"
      flexShrink={1}
    >
      <Token
        size="sm"
        tokenImageUri={tokenImageUri}
        tokenImageUris={tokenImageUris}
        flexShrink={0}
      />
      <SizableText
        size="$headingXs"
        numberOfLines={1}
        ellipsizeMode="tail"
        flexShrink={1}
      >
        {name}
      </SizableText>
    </XStack>
  );
}
