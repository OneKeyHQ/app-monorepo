import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import { Button, XStack, YStack } from '@onekeyhq/components';
import { usePerpsActiveTwapOrdersAtom } from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IPerpSimplePortfolioTab } from '@onekeyhq/shared/src/routes/perp';
import { formatTime } from '@onekeyhq/shared/src/utils/dateUtils';
import {
  isSpotInstrument,
  parseDexCoin,
} from '@onekeyhq/shared/src/utils/perpsUtils';
import type { IPerpsAssetPosition } from '@onekeyhq/shared/types/hyperliquid';

import { usePerpsAccountScopedCacheAddress } from '../../hooks/usePerpsAccountScopedCacheAddress';
import { usePerpsAccountScopedOpenOrdersByCoin } from '../../hooks/usePerpsAccountScopedOpenOrdersByCoin';
import { getPerpsAccountScopedListData } from '../../utils/accountScopedData';
import { simplePrice } from '../../utils/simpleDisplay';
import {
  getSimpleOrderSummary,
  isSimplePositionSizedOrder,
} from '../../utils/simpleOrderSummary';
import { useOpenOrderActions } from '../OrderInfoPanel/hooks/useOpenOrderActions';
import { canChasePerpsOrder } from '../OrderInfoPanel/utils';

import { SimpleOrderSummary } from './SimpleOrderSummary';
import { SimplePortfolioTabs } from './SimplePortfolioTabs';
import { SimplePositionCard } from './SimplePositionCard';
import { SimpleTwapEntry } from './SimpleTwapEntry';

export function SimpleMarketPortfolio({
  coin,
  position,
  initialTab,
}: {
  coin: string;
  position?: IPerpsAssetPosition;
  initialTab?: IPerpSimplePortfolioTab;
}) {
  const intl = useIntl();
  const scopedOrders = usePerpsAccountScopedOpenOrdersByCoin(coin);
  const orders = scopedOrders.filter((order) => !isSpotInstrument(order.coin));
  const accountAddress = usePerpsAccountScopedCacheAddress();
  const {
    canMutateScopedOrders,
    chasingOrderIds,
    handleCancelOrder,
    handleChaseOrderPress,
  } = useOpenOrderActions(accountAddress);
  const [twapState] = usePerpsActiveTwapOrdersAtom();
  const twapOrders = getPerpsAccountScopedListData({
    activeAccountAddress: accountAddress,
    dataAccountAddress: twapState.accountAddress,
    data: twapState.twapOrders.filter(
      (order) =>
        order.state.coin === coin && !isSpotInstrument(order.state.coin),
    ),
  });
  const symbol = parseDexCoin(coin).displayName;
  const quantity = (value: BigNumber.Value) => {
    const number = new BigNumber(value);
    return number.isFinite() ? `${number.toFormat()} ${symbol}` : '--';
  };
  const detail = (id: ETranslations, value: string) => ({
    label: intl.formatMessage({ id }),
    value,
  });
  const time = (timestamp: number) =>
    formatTime(new Date(timestamp), {
      formatTemplate: 'yyyy-LL-dd HH:mm:ss',
    });
  if (!position && orders.length === 0 && twapOrders.length === 0) return null;
  return (
    <YStack gap="$3">
      <SimplePortfolioTabs
        positionCount={position ? 1 : 0}
        orderCount={orders.length + twapOrders.length}
        testIDPrefix="perps-simple-market"
        initialTab={initialTab}
      >
        {(activePortfolioTab) => (
          <>
            {activePortfolioTab === 'positions' && position ? (
              <SimplePositionCard item={position} />
            ) : null}
            {activePortfolioTab === 'orders' ? (
              <YStack gap="$3">
                {orders.map((order) => {
                  const summary = getSimpleOrderSummary(order);
                  const positionSized = isSimplePositionSizedOrder(order);
                  const details = [
                    detail(
                      ETranslations.perp_open_orders_original_size,
                      positionSized ? '--' : quantity(order.origSz),
                    ),
                    detail(
                      ETranslations.perp_executed_size__title,
                      positionSized
                        ? '--'
                        : quantity(
                            BigNumber.maximum(
                              0,
                              new BigNumber(order.origSz).minus(order.sz),
                            ),
                          ),
                    ),
                    detail(
                      ETranslations.perp_chase_unfilled_size__title,
                      positionSized ? '--' : quantity(order.sz),
                    ),
                    detail(
                      ETranslations.perp_open_orders_time,
                      time(order.timestamp),
                    ),
                  ];
                  if (order.isTrigger) {
                    details.unshift(
                      detail(
                        ETranslations.perp_orderbook_price,
                        summary.orderType.endsWith('Market')
                          ? intl.formatMessage({
                              id: ETranslations.perp_position_market,
                            })
                          : simplePrice(order.limitPx),
                      ),
                      detail(
                        ETranslations.perp_open_orders_trigger_condition,
                        order.triggerCondition || '--',
                      ),
                    );
                  }
                  return (
                    <SimpleOrderSummary
                      key={order.oid}
                      {...summary}
                      details={details}
                      actions={
                        <XStack gap="$3">
                          {canChasePerpsOrder(order) ? (
                            <Button
                              testID={`perps-simple-chase-order-${order.oid}`}
                              flex={1}
                              variant="secondary"
                              borderRadius="$full"
                              disabled={
                                !canMutateScopedOrders ||
                                chasingOrderIds.has(order.oid)
                              }
                              loading={chasingOrderIds.has(order.oid)}
                              onPressLoadingEnabled
                              onPress={() => handleChaseOrderPress(order)}
                            >
                              {intl.formatMessage({
                                id: ETranslations.chase__action,
                              })}
                            </Button>
                          ) : null}
                          <Button
                            testID={`perps-simple-close-order-${order.oid}`}
                            flex={1}
                            variant="primary"
                            borderRadius="$full"
                            disabled={
                              !canMutateScopedOrders ||
                              chasingOrderIds.has(order.oid)
                            }
                            onPressLoadingEnabled
                            onPress={() => handleCancelOrder(order)}
                          >
                            {intl.formatMessage({
                              id: ETranslations.perp_open_orders_cancel,
                            })}
                          </Button>
                        </XStack>
                      }
                    />
                  );
                })}
                <SimpleTwapEntry count={twapOrders.length} />
              </YStack>
            ) : null}
          </>
        )}
      </SimplePortfolioTabs>
    </YStack>
  );
}
