import { memo } from 'react';

import { Button, SizableText, XStack } from '@onekeyhq/components';
import type { IWsWebData2 } from '@onekeyhq/shared/types/hyperliquid/sdk';

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

const OpenOrdersRow = memo(
  ({ order }: { order: IWsWebData2['openOrders'][number] }) => {
    const { limitPx, coin, side, sz } = order;

    return (
      <XStack
        py="$2"
        px="$3"
        alignItems="center"
        hoverStyle={{ bg: '$bgHover' }}
        bg="$bg"
        borderBottomWidth="$px"
        borderBottomColor="$borderSubdued"
        minWidth={Object.values(COLUMN_WIDTHS).reduce(
          (sum, width) => sum + width,
          0,
        )}
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
          <SizableText size="$bodyMd">{sz}</SizableText>
        </XStack>

        <XStack width={COLUMN_WIDTHS.size} justifyContent="flex-start">
          <SizableText size="$bodyMd">${limitPx}</SizableText>
        </XStack>

        <XStack width={COLUMN_WIDTHS.time} justifyContent="flex-start">
          <SizableText size="$bodyMd">${limitPx}</SizableText>
        </XStack>

        <XStack
          width={COLUMN_WIDTHS.actions}
          space="$2"
          justifyContent="flex-start"
        >
          <Button size="small" variant="secondary" disabled>
            <SizableText size="$bodySm">Cancel</SizableText>
          </Button>
        </XStack>
      </XStack>
    );
  },
);

OpenOrdersRow.displayName = 'OpenOrdersRow';
export { OpenOrdersRow };
