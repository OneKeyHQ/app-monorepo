import { useIntl } from 'react-intl';

import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { Token } from '@onekeyhq/kit/src/components/Token';
import type { IHeadlessBuyOrder } from '@onekeyhq/shared/types/fiatCrypto';

import {
  formatHeadlessBuyOrderTime,
  formatHeadlessBuyOrderTitle,
} from './orderFormat';
import { OrderStatusBadge } from './OrderStatusBadge';

export function OrderListItem({
  order,
  onPress,
}: {
  order: IHeadlessBuyOrder;
  onPress: (order: IHeadlessBuyOrder) => void;
}) {
  const intl = useIntl();
  return (
    <ListItem
      testID="headless-buy-order-item"
      userSelect="none"
      onPress={() => onPress(order)}
    >
      <Token
        size="lg"
        tokenImageUri={order.tokenLogoURI}
        networkImageUri={order.networkLogoURI}
      />
      <ListItem.Text
        flex={1}
        primary={formatHeadlessBuyOrderTitle(intl, order)}
        secondary={formatHeadlessBuyOrderTime(order)}
      />
      <OrderStatusBadge status={order.status} />
    </ListItem>
  );
}
