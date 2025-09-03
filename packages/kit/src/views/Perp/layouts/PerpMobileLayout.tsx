import { useCallback } from 'react';

import { SizableText, Tabs, XStack, YStack } from '@onekeyhq/components';

export function PerpMobileLayout() {
  const renderTabHeader = useCallback(() => {
    return (
      <XStack gap="$3">
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
      <XStack>
        <SizableText>BTC</SizableText>
      </XStack>
      <Tabs.Container
        initialTabName="Orders"
        renderHeader={renderTabHeader}
        renderTabBar={(props) => <Tabs.TabBar {...props} />}
      >
        <Tabs.Tab name="Orders">
          <Tabs.ScrollView>
            <SizableText>Orders</SizableText>
          </Tabs.ScrollView>
        </Tabs.Tab>
        <Tabs.Tab name="Positions">
          <Tabs.ScrollView>
            <SizableText>Positions</SizableText>
          </Tabs.ScrollView>
        </Tabs.Tab>
      </Tabs.Container>
    </YStack>
  );
}
