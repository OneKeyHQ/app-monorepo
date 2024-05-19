import { SizableText, YStack } from '@onekeyhq/components';

export function TokenPriceChart({ coinGeckoId }: { coinGeckoId: string }) {
  return (
    <YStack width="100%" $gtMd={{ px: '$5' }}>
      <SizableText>{coinGeckoId}</SizableText>
    </YStack>
  );
}
