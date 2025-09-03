import { useCallback } from 'react';

import { SizableText, Tabs, XStack, YStack } from '@onekeyhq/components';

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
      <Tabs.Container
        initialTabName="Orders"
        renderHeader={renderTabHeader}
        renderTabBar={(props) => <Tabs.TabBar {...props} />}
      >
        <Tabs.Tab name="Orders">
          <Tabs.ScrollView contentContainerStyle={{ paddingHorizontal: 20 }}>
            <SizableText>Orders</SizableText>
          </Tabs.ScrollView>
        </Tabs.Tab>
        <Tabs.Tab name="Positions">
          <Tabs.ScrollView contentContainerStyle={{ paddingHorizontal: 20 }}>
            <SizableText>Positions</SizableText>
          </Tabs.ScrollView>
        </Tabs.Tab>
      </Tabs.Container>
    </YStack>
  );
}
