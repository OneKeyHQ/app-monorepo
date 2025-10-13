import { useMemo, useRef } from 'react';

import { useIntl } from 'react-intl';

import type { ITabContainerRef } from '@onekeyhq/components';
import {
  DebugRenderTracker,
  SizableText,
  Tabs,
  XStack,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import {
  usePerpsActiveOpenOrdersLengthAtom,
  usePerpsActivePositionLengthAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid/atoms';
import { perpsTradesHistoryRefreshHookAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { PerpOpenOrdersList } from './List/PerpOpenOrdersList';
import { PerpPositionsList } from './List/PerpPositionsList';
import { PerpTradesHistoryList } from './List/PerpTradesHistoryList';

const tabNameToTranslationKey = {
  'Positions': ETranslations.perp_position_title,
  'Open Orders': ETranslations.perp_open_orders_title,
  'Trades History': ETranslations.perp_trades_history_title,
};

function TabBarItem({
  name,
  isFocused,
  onPress,
}: {
  name: string;
  isFocused: boolean;
  onPress: (name: string) => void;
}) {
  const intl = useIntl();

  const [openOrdersLength] = usePerpsActiveOpenOrdersLengthAtom();
  const [positionsLength] = usePerpsActivePositionLengthAtom();

  const tabCount = useMemo(() => {
    if (name === 'Trades History') {
      return '';
    }
    if (name === 'Positions' && positionsLength > 0) {
      return `(${positionsLength})`;
    }
    if (name === 'Open Orders' && openOrdersLength > 0) {
      return `(${openOrdersLength})`;
    }
    return '';
  }, [positionsLength, openOrdersLength, name]);

  return (
    <DebugRenderTracker
      position="bottom-center"
      name={`PerpOrderInfoPanel_TabBarItem_${name}`}
    >
      <XStack
        py="$3"
        ml="$5"
        mr="$2"
        borderBottomWidth={isFocused ? '$0.5' : '$0'}
        borderBottomColor="$borderActive"
        onPress={() => onPress(name)}
      >
        <SizableText size="$headingXs">
          {`${intl.formatMessage({
            id: tabNameToTranslationKey[
              name as keyof typeof tabNameToTranslationKey
            ],
          })} ${tabCount}`}
        </SizableText>
      </XStack>
    </DebugRenderTracker>
  );
}

function PerpOrderInfoPanel() {
  const tabsRef = useRef<ITabContainerRef | null>(null);

  const handleViewTpslOrders = () => {
    tabsRef.current?.jumpToTab('Open Orders');
  };

  const lastSubscriptionsHandlerDisabledCount = useRef<number>(-1);

  return (
    <Tabs.Container
      ref={tabsRef as any}
      headerHeight={80}
      initialTabName="Positions"
      onTabChange={async (tab) => {
        if (tab.tabName === 'Trades History') {
          const subscriptionsHandlerDisabledCount =
            await backgroundApiProxy.serviceHyperliquidSubscription.getSubscriptionsHandlerDisabledCount();
          if (
            subscriptionsHandlerDisabledCount >
            lastSubscriptionsHandlerDisabledCount.current
          ) {
            lastSubscriptionsHandlerDisabledCount.current =
              subscriptionsHandlerDisabledCount;
            void perpsTradesHistoryRefreshHookAtom.set({
              refreshHook: Date.now(),
            });
          }
        }
      }}
      renderTabBar={(props) => (
        <Tabs.TabBar
          {...props}
          renderItem={({ name, isFocused, onPress }) => (
            <TabBarItem name={name} isFocused={isFocused} onPress={onPress} />
          )}
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
        <PerpTradesHistoryList useTabsList />
      </Tabs.Tab>
    </Tabs.Container>
  );
}

export { PerpOrderInfoPanel };
