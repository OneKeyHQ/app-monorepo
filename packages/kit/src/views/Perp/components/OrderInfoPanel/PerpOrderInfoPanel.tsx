import { Tabs, YStack } from '@onekeyhq/components';

import { PerpOpenOrdersList } from './List/PerpOpenOrdersList';
import { PerpPositionsList } from './List/PerpPositionsList';

function PerpOrderInfoPanel() {
  return (
    <YStack flex={1} minHeight={300} overflow="hidden">
      <Tabs.Container
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
          <PerpPositionsList />
        </Tabs.Tab>
        <Tabs.Tab name="Open Orders">
          <PerpOpenOrdersList />
        </Tabs.Tab>
        {/* <Tabs.Tab name="Trades"> */}
        {/* <PerpTradeHistory /> */}
        {/* </Tabs.Tab> */}
      </Tabs.Container>
    </YStack>
  );
}

export { PerpOrderInfoPanel };
