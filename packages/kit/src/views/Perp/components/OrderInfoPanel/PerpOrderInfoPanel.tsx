import { useCallback, useRef } from 'react';

import { useIntl } from 'react-intl';

import type { IModalNavigationProp } from '@onekeyhq/components';
import {
  IconButton,
  SizableText,
  Tabs,
  XStack,
  YStack,
} from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EModalRoutes } from '@onekeyhq/shared/src/routes';
import type { IModalPerpParamList } from '@onekeyhq/shared/src/routes/perp';
import { EModalPerpRoutes } from '@onekeyhq/shared/src/routes/perp';

import { usePerpPositions } from '../../hooks';
import { usePerpOrders } from '../../hooks/usePerpOrderInfoPanel';

import { PerpOpenOrdersList } from './List/PerpOpenOrdersList';
import { PerpPositionsList } from './List/PerpPositionsList';
import { PerpTradesHistoryList } from './List/PerpTradesHistoryList';

interface IPerpOrderInfoPanelProps {
  isMobile?: boolean;
}

function PerpOrderInfoPanel({ isMobile }: IPerpOrderInfoPanelProps) {
  const intl = useIntl();
  const orders = usePerpOrders();
  const positions = usePerpPositions();
  const tabsRef = useRef<{
    switchTab: (tabName: string) => void;
  } | null>(null);
  const tabNameToTranslationKey = {
    'Positions': ETranslations.perp_position_title,
    'Open Orders': ETranslations.perp_open_orders_title,
    'Trades History': ETranslations.perp_trades_history_title,
  };
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

  const tabCount = useCallback(
    (name: string) => {
      if (name === 'Trades History') {
        return '';
      }
      if (name === 'Positions' && positions.length > 0) {
        return `(${positions.length})`;
      }
      if (name === 'Open Orders' && orders.length > 0) {
        return `(${orders.length})`;
      }
      return '';
    },
    [positions.length, orders.length],
  );

  return (
    <YStack overflow="hidden">
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
                  })} ${tabCount(name)}`}
                </SizableText>
              </XStack>
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
            <PerpTradesHistoryList />
          </Tabs.Tab>
        ) : null}
      </Tabs.Container>
    </YStack>
  );
}

export { PerpOrderInfoPanel };
