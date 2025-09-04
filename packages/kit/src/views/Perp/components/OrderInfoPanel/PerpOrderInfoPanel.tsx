import { useRef } from 'react';

import { Tabs, YStack } from '@onekeyhq/components';

import { PerpOpenOrdersList } from './List/PerpOpenOrdersList';
import { PerpPositionsList } from './List/PerpPositionsList';
import { PerpTradesHistoryList } from './List/PerpTradesHistoryList';

function PerpOrderInfoPanel() {
  const tabsRef = useRef<{
    switchTab: (tabName: string) => void;
  } | null>(null);
  const handleViewTpslOrders = () => {
    tabsRef.current?.switchTab('Open Orders');
  };
  return (
    <YStack flex={1} minHeight={300} overflow="hidden">
      <Tabs.Container
        ref={tabsRef as any}
        headerHeight={80}
        initialTabName="Positions"
        renderTabBar={(props) => (
          <Tabs.TabBar
            {...props}
            containerStyle={{
              borderRadius: 0,
              margin: 0,
              padding: 0,
            }}
          />
        )}
      >
        <Tabs.Tab name="Positions">
          <PerpPositionsList handleViewTpslOrders={handleViewTpslOrders} />
        </Tabs.Tab>
        <Tabs.Tab name="Open Orders">
          <PerpOpenOrdersList />
        </Tabs.Tab>
        <Tabs.Tab name="Trades History">
          <PerpTradesHistoryList />
        </Tabs.Tab>
      </Tabs.Container>
    </YStack>
  );
}

export { PerpOrderInfoPanel };
