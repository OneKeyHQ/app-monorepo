import { useCallback, useMemo, useRef } from 'react';

import { useIntl } from 'react-intl';

import type {
  IModalNavigationProp,
  ITabContainerRef,
} from '@onekeyhq/components';
import {
  DebugRenderTracker,
  IconButton,
  SizableText,
  Tabs,
  XStack,
} from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import {
  usePerpsActiveOpenOrdersAtom,
  usePerpsActiveOpenOrdersLengthAtom,
  usePerpsActivePositionLengthAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EModalRoutes } from '@onekeyhq/shared/src/routes';
import type { IModalPerpParamList } from '@onekeyhq/shared/src/routes/perp';
import { EModalPerpRoutes } from '@onekeyhq/shared/src/routes/perp';

import { usePerpsActivePositionAtom } from '../../hooks';

import { PerpOpenOrdersList } from './List/PerpOpenOrdersList';
import { PerpPositionsList } from './List/PerpPositionsList';
import { PerpTradesHistoryList } from './List/PerpTradesHistoryList';

interface IPerpOrderInfoPanelProps {
  isMobile?: boolean;
}

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

function PerpOrderInfoPanel({ isMobile }: IPerpOrderInfoPanelProps) {
  const intl = useIntl();

  const tabsRef = useRef<ITabContainerRef | null>(null);

  const handleViewTpslOrders = () => {
    tabsRef.current?.jumpToTab('Open Orders');
  };
  const navigation =
    useAppNavigation<IModalNavigationProp<IModalPerpParamList>>();
  const handleViewTradesHistory = () => {
    navigation.pushModal(EModalRoutes.PerpModal, {
      screen: EModalPerpRoutes.PerpTradersHistoryList,
    });
  };

  return (
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
          isMobile={isMobile}
        />
      </Tabs.Tab>
      <Tabs.Tab name="Open Orders">
        <PerpOpenOrdersList isMobile={isMobile} />
      </Tabs.Tab>
      {!isMobile ? (
        <Tabs.Tab name="Trades History">
          <PerpTradesHistoryList useTabsList />
        </Tabs.Tab>
      ) : null}
    </Tabs.Container>
  );
}

export { PerpOrderInfoPanel };
