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
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { PerpAccountList } from './List/PerpAccountList';
import { PerpOpenOrdersList } from './List/PerpOpenOrdersList';
import { PerpPositionsList } from './List/PerpPositionsList';
import { PerpTradesHistoryList } from './List/PerpTradesHistoryList';

const tabNameToTranslationKey: Record<string, string> = {
  'Positions': ETranslations.perp_position_title,
  'Open Orders': ETranslations.perp_open_orders_title,
  'Trades History': ETranslations.perp_trades_history_title,
  'Account': ETranslations.perp_account_history,
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

  const translationKey = tabNameToTranslationKey[name];
  let tabTitle = translationKey;
  if (translationKey.startsWith('perp.')) {
    tabTitle = intl.formatMessage({
      id: translationKey as ETranslations,
    });
  }

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
        <SizableText size="$headingXs">{`${tabTitle} ${tabCount}`}</SizableText>
      </XStack>
    </DebugRenderTracker>
  );
}

function PerpOrderInfoPanel() {
  const tabsRef = useRef<ITabContainerRef | null>(null);

  const handleViewTpslOrders = () => {
    tabsRef.current?.jumpToTab('Open Orders');
  };

  return (
    <Tabs.Container
      ref={tabsRef as any}
      headerHeight={80}
      initialTabName="Positions"
      onTabChange={async (tab) => {
        if (tab.tabName === 'Account') {
          void backgroundApiProxy.serviceHyperliquidSubscription.enableLedgerUpdatesSubscription();
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
      <Tabs.Tab name="Account">
        <PerpAccountList useTabsList />
      </Tabs.Tab>
    </Tabs.Container>
  );
}

export { PerpOrderInfoPanel };
