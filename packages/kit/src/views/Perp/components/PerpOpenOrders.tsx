import React, { memo } from 'react';

import type { WsWebData2 } from '@onekeyhq/shared/types/hyperliquid/sdk';

import {
  Button,
  ScrollView,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components';

import { usePerpOrders } from '../hooks/usePerpPortfolio';

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

const PerpOrdersRow = memo(({ order }: { order: WsWebData2['openOrders'][number] }) => {
  const {
    triggerCondition,
    orderType,
    tif,
    limitPx,
    coin,
    side,
    sz,
    timestamp,
    origSz,
    cloid,
    reduceOnly,
    oid,
  } = order
  return (
    <XStack
      py="$2"
      px="$3"
      alignItems="center"
      hoverStyle={{ bg: '$bgHover' }}
      bg="$bg"
      borderBottomWidth="$px"
      borderBottomColor="$borderSubdued"
      minWidth={Object.values(COLUMN_WIDTHS).reduce((sum, width) => sum + width, 0)}
    >
      <XStack width={COLUMN_WIDTHS.side} justifyContent="flex-start">
        <XStack
          width="$1"
          height={20}
          bg={side === 'B' ? '$green7' : '$red7'}
        />
      </XStack>
      
      <XStack width={COLUMN_WIDTHS.coin} alignItems="center" space="$2">
        <SizableText size="$bodyMd" fontWeight="600">
          {coin}
        </SizableText>
        <SizableText
          size="$bodySm"
          color={side === 'B' ? '$textSuccess' : '$textCritical'}
          bg={side === 'B' ? '$green3' : '$red3'}
          px="$2"
          py="$1"
          borderRadius="$2"
        >
          {limitPx}
        </SizableText>
      </XStack>

      <XStack width={COLUMN_WIDTHS.limitPrice} justifyContent="flex-start">
        <SizableText size="$bodyMd">
          {sz}
        </SizableText>
      </XStack>

      <XStack width={COLUMN_WIDTHS.size} justifyContent="flex-start">
        <SizableText size="$bodyMd">
          ${limitPx}
        </SizableText>
      </XStack>

      <XStack width={COLUMN_WIDTHS.time} justifyContent="flex-start">
        <SizableText size="$bodyMd">
          ${limitPx}
        </SizableText>
      </XStack>

      <XStack width={COLUMN_WIDTHS.actions} space="$2" justifyContent="flex-start">
        <Button size="small" variant="secondary" disabled>
          <SizableText size="$bodySm">Cancel</SizableText>
        </Button>
      </XStack>
    </XStack>
  );
}, (prevProps, nextProps) => {
  const prev = prevProps.order;
  const next = nextProps.order;
  
  return (
    prev.coin === next.coin
  );
});

function PerpOpenOrders() {
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
        <SizableText size="$bodySm" color="$textSubdued" textAlign="center" mt="$2">
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
            <PerpOrdersRow
              key={`${order.oid}-${order.cloid}`}
              order={order}
            />
          ))}
        </YStack>
      </ScrollView>
    </YStack>
  );
}

export { PerpOpenOrders };