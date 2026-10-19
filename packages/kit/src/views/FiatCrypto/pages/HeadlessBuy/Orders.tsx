import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import {
  Empty,
  ListView,
  Page,
  Stack,
  useSafeAreaInsets,
} from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EModalFiatCryptoRoutes } from '@onekeyhq/shared/src/routes';
import type { IHeadlessBuyOrder } from '@onekeyhq/shared/types/fiatCrypto';

import { OrderListItem } from '../../components/Headless/OrderListItem';
import { useHeadlessBuyOrders } from '../../hooks/useHeadlessBuyOrders';

function keyExtractor(item: IHeadlessBuyOrder) {
  return item.transactionId;
}

// Every native buy order on this device, all accounts, newest first. Entered
// from the Buy/Sell header icon or the multi-order banner; entering performs
// one status refresh (hook option).
function HeadlessBuyOrdersPage() {
  const intl = useIntl();
  const navigation = useAppNavigation();
  const { bottom } = useSafeAreaInsets();
  const { visibleOrders, isReady } = useHeadlessBuyOrders({
    refreshOnMount: true,
  });

  const openOrder = useCallback(
    (order: IHeadlessBuyOrder) => {
      navigation.push(EModalFiatCryptoRoutes.HeadlessBuyOrderDetail, {
        transactionId: order.transactionId,
      });
    },
    [navigation],
  );

  return (
    <Page>
      <Page.Header
        title={intl.formatMessage({ id: ETranslations.buy_orders__title })}
      />
      <Page.Body>
        <ListView
          testID="headless-buy-orders-list"
          data={visibleOrders}
          estimatedItemSize={72}
          keyExtractor={keyExtractor}
          renderItem={({ item }) => (
            <OrderListItem order={item} onPress={openOrder} />
          )}
          ListFooterComponent={<Stack h={bottom || '$2'} />}
          ListEmptyComponent={
            isReady ? (
              <Empty
                illustration="Orders"
                title={intl.formatMessage({
                  id: ETranslations.global_no_results,
                })}
              />
            ) : null
          }
        />
      </Page.Body>
    </Page>
  );
}

export default HeadlessBuyOrdersPage;
