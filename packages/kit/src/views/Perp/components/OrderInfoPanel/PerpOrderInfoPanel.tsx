import { useRef } from 'react';

import { Button, IconButton, Tabs, YStack } from '@onekeyhq/components';

import { PerpOpenOrdersList } from './List/PerpOpenOrdersList';
import { PerpPositionsList } from './List/PerpPositionsList';
import { PerpTradesHistoryList } from './List/PerpTradesHistoryList';

interface IPerpOrderInfoPanelProps {
  isMobile?: boolean;
}

function PerpOrderInfoPanel({ isMobile }: IPerpOrderInfoPanelProps) {
  const tabsRef = useRef<{
    switchTab: (tabName: string) => void;
  } | null>(null);
  const handleViewTpslOrders = () => {
    tabsRef.current?.switchTab('Open Orders');
  };
  const handleViewTradesHistory = () => {
    // todo
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
            renderToolbar={
              isMobile
                ? () => (
                    <IconButton
                      variant="tertiary"
                      size="small"
                      mr="$2"
                      borderRadius="$full"
                      icon="ClockTimeHistoryOutline"
                      onPress={handleViewTradesHistory}
                    />
                  )
                : undefined
            }
            containerStyle={{
              borderRadius: 0,
              margin: 0,
              padding: 0,
            }}
          />
        )}
      >
        <Tabs.Tab name="Positions">
          <PerpPositionsList
            handleViewTpslOrders={handleViewTpslOrders}
            isMobile={isMobile}
          />
        </Tabs.Tab>
        <Tabs.Tab name="Open Orders">
          <PerpOpenOrdersList isMobile={isMobile} />
        </Tabs.Tab>
        {!isMobile ? (
          <Tabs.Tab name="Trades History">
            <PerpTradesHistoryList />
          </Tabs.Tab>
        ) : null}
      </Tabs.Container>
    </YStack>
  );
}

export { PerpOrderInfoPanel };
