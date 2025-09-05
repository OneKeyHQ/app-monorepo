import { useCallback } from 'react';

import { SizableText, Tabs, XStack, YStack } from '@onekeyhq/components';

import { PerpOrderInfoPanel } from '../components/OrderInfoPanel/PerpOrderInfoPanel';

export function PerpMobileLayout() {
  const renderTabHeader = useCallback(() => {
    return (
      <XStack gap="$3" px="$5">
        <YStack>
          <SizableText>Long Or Short</SizableText>
        </YStack>
        <YStack>
          <SizableText>PriceBook</SizableText>
        </YStack>
      </XStack>
    );
  }, []);
  return (
    <YStack>
      <XStack px="$5">
        <SizableText>BTC</SizableText>
      </XStack>
      <YStack flex={0.4} minHeight={300}>
        <PerpOrderInfoPanel isMobile />
      </YStack>
    </YStack>
  );
}
