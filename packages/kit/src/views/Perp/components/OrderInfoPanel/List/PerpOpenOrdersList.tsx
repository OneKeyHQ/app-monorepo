import { ScrollView, SizableText, XStack, YStack } from '@onekeyhq/components';

import { usePerpOrders } from '../../../hooks/usePerpOrderInfoPanel';
import { OpenOrdersRow } from '../Components/OpenOrdersRow';

const COLUMN_WIDTHS = {
  side: 10,
  coin: 140,
  limitPrice: 120,
  size: 100,
  time: 100,
  type: 140,
  tif: 100,
  actions: 140,
};

function PerpOpenOrdersList() {
  const orders = usePerpOrders();
  console.log('orders', orders);
  const totalWidth = Object.values(COLUMN_WIDTHS).reduce(
    (sum, width) => sum + width,
    0,
  );

  if (!orders.length) {
    return (
      <YStack flex={1} justifyContent="center" alignItems="center" p="$6">
        <SizableText size="$bodyMd" color="$textSubdued" textAlign="center">
          No open orders
        </SizableText>
        <SizableText
          size="$bodySm"
          color="$textSubdued"
          textAlign="center"
          mt="$2"
        >
          Your orders will appear here after opening trades
        </SizableText>
      </YStack>
    );
  }

  return (
    <YStack flex={1} overflow="hidden">
      {/* Column Headers */}
      <XStack
        py="$2"
        px="$3"
        minWidth={totalWidth}
        borderBottomWidth="$px"
        borderBottomColor="$borderSubdued"
        bg="$bgSubtle"
      >
        <XStack width={COLUMN_WIDTHS.side} />
        <XStack width={COLUMN_WIDTHS.coin}>
          <SizableText size="$bodySm" color="$textSubdued" fontWeight="600">
            Coin
          </SizableText>
        </XStack>
        <XStack width={COLUMN_WIDTHS.size}>
          <SizableText size="$bodySm" color="$textSubdued" fontWeight="600">
            Limit Price
          </SizableText>
        </XStack>
        <XStack width={COLUMN_WIDTHS.size}>
          <SizableText size="$bodySm" color="$textSubdued" fontWeight="600">
            Size
          </SizableText>
        </XStack>
        <XStack width={COLUMN_WIDTHS.time}>
          <SizableText size="$bodySm" color="$textSubdued" fontWeight="600">
            Time
          </SizableText>
        </XStack>
        <XStack width={COLUMN_WIDTHS.type}>
          <SizableText size="$bodySm" color="$textSubdued" fontWeight="600">
            Type
          </SizableText>
        </XStack>
        <XStack width={COLUMN_WIDTHS.tif}>
          <SizableText size="$bodySm" color="$textSubdued" fontWeight="600">
            TIF
          </SizableText>
        </XStack>
        <XStack width={COLUMN_WIDTHS.actions}>
          <SizableText size="$bodySm" color="$textSubdued" fontWeight="600">
            Actions
          </SizableText>
        </XStack>
      </XStack>

      {/* Positions List */}
      <ScrollView
        flex={1}
        horizontal
        showsHorizontalScrollIndicator
        contentContainerStyle={{ minWidth: totalWidth }}
      >
        <YStack>
          {orders.map((order) => (
            <OpenOrdersRow key={`${order.oid}-${order.cloid}`} order={order} />
          ))}
        </YStack>
      </ScrollView>
    </YStack>
  );
}

export { PerpOpenOrdersList };
