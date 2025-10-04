import { useMemo, useRef } from 'react';

import { useIntl } from 'react-intl';

import type { IModalNavigationProp } from '@onekeyhq/components';
import {
  DebugRenderTracker,
  IconButton,
  SizableText,
  Tabs,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EModalRoutes } from '@onekeyhq/shared/src/routes';
import type { IModalPerpParamList } from '@onekeyhq/shared/src/routes/perp';
import { EModalPerpRoutes } from '@onekeyhq/shared/src/routes/perp';

import useAppNavigation from '../../../hooks/useAppNavigation';
import {
  usePerpsActiveOpenOrdersLengthAtom,
  usePerpsActivePositionLengthAtom,
} from '../../../states/jotai/contexts/hyperliquid/atoms';
import { PerpOpenOrdersList } from '../components/OrderInfoPanel/List/PerpOpenOrdersList';
import { PerpPositionsList } from '../components/OrderInfoPanel/List/PerpPositionsList';
import { PerpOrderBook } from '../components/PerpOrderBook';
import { PerpTips } from '../components/PerpTips';
import { PerpTickerBar } from '../components/TickerBar/PerpTickerBar';
import { PerpTradingPanel } from '../components/TradingPanel/PerpTradingPanel';

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
  }, [name, positionsLength, openOrdersLength]);

  return (
    <DebugRenderTracker
      position="bottom-center"
      name={`PerpMobileLayout_TabBarItem_${name}`}
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

export function PerpMobileLayout() {
  const tabsRef = useRef<{
    switchTab: (tabName: string) => void;
  } | null>(null);
  const handleViewTpslOrders = () => {
    tabsRef.current?.switchTab('Open Orders');
  };
  const navigation =
    useAppNavigation<IModalNavigationProp<IModalPerpParamList>>();
  const handleViewTradesHistory = () => {
    navigation.pushModal(EModalRoutes.PerpModal, {
      screen: EModalPerpRoutes.PerpTradersHistoryList,
    });
  };

  const tabHeader = useMemo(
    () => (
      <YStack bg="$bgApp" pointerEvents="box-none">
        <PerpTips />
        <PerpTickerBar />

        <XStack gap="$2.5" px="$4" pb="$4">
          <YStack flexBasis="35%" flexShrink={1}>
            <PerpOrderBook />
          </YStack>
          <YStack flexBasis="65%" flexShrink={1}>
            <PerpTradingPanel isMobile />
          </YStack>
        </XStack>
      </YStack>
    ),
    [],
  );
  return (
    <Tabs.Container
      ref={tabsRef as any}
      renderHeader={() => tabHeader}
      initialTabName="Positions"
      renderTabBar={(props) => (
        <Tabs.TabBar
          {...props}
          renderToolbar={() => (
            <IconButton
              variant="tertiary"
              size="small"
              mr="$2"
              borderRadius="$full"
              icon="ClockTimeHistoryOutline"
              onPress={handleViewTradesHistory}
            />
          )}
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
        <PerpPositionsList
          handleViewTpslOrders={handleViewTpslOrders}
          isMobile
        />
      </Tabs.Tab>
      <Tabs.Tab name="Open Orders">
        <PerpOpenOrdersList isMobile />
      </Tabs.Tab>
    </Tabs.Container>
  );
}
