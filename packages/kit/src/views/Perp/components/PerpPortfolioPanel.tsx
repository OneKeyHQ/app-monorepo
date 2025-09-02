import { Tabs, YStack } from '@onekeyhq/components';

import { PerpOpenOrders } from './PerpOpenOrders';
import { PerpPositionsList } from './PerpPositionsList';
// import { PerpTradeHistory } from './PerpTradeHistory';

function PerpPortfolioPanel() {
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
          <PerpOpenOrders />
        </Tabs.Tab>
        {/* <Tabs.Tab name="Trades"> */}
        {/* <PerpTradeHistory /> */}
        {/* </Tabs.Tab> */}
      </Tabs.Container>
    </YStack>
  );
}

export { PerpPortfolioPanel };
