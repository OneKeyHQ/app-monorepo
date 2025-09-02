import { memo, useMemo } from 'react';

import { Button, SizableText, XStack, YStack } from '@onekeyhq/components';
import type { IWsWebData2 } from '@onekeyhq/shared/types/hyperliquid/sdk';

import { useTokenList } from '../../../hooks';
import { formatPriceToSignificantDigits } from '../../../utils/tokenUtils';
import { showClosePositionDialog } from '../ClosePositionModal';

const COLUMN_WIDTHS = {
  side: 10,
  symbol: 140,
  size: 120,
  entryPrice: 100,
  markPrice: 100,
  pnl: 140,
  margin: 100,
  liqPrice: 100,
  actions: 140,
};

const PositionRow = memo(
  ({
    pos,
    mid,
    actions,
  }: {
    pos: IWsWebData2['clearinghouseState']['assetPositions'][number]['position'];
    mid?: string;
    actions: any;
  }) => {
    const { getTokenInfo } = useTokenList();

    console.log('PerpPositionRow props:', {
      coin: pos.coin,
      mid,
      midType: typeof mid,
      midLength: mid?.length,
    });
    const side = parseFloat(pos.szi || '0') >= 0 ? 'long' : 'short';
    const size = Math.abs(parseFloat(pos.szi || '0'));
    const entryPrice = parseFloat(pos.entryPx || '0');
    const unrealizedPnl = parseFloat(pos.unrealizedPnl || '0');
    const marginUsed = parseFloat(pos.marginUsed || '0');
    const liquidationPrice = pos.liquidationPx || '0';

    // Calculate mark price from position value and size
    const markPrice = mid || '0';

    // Calculate ROE percentage
    const roiPercent = marginUsed > 0 ? (unrealizedPnl / marginUsed) * 100 : 0;

    const isProfit = unrealizedPnl >= 0;
    const displayLiqPrice =
      liquidationPrice === '0'
        ? 'N/A'
        : `$${
            parseFloat(liquidationPrice) > 0
              ? formatPriceToSignificantDigits(parseFloat(liquidationPrice), 5)
              : '0'
          }`;
    const formattedSize = `${size.toFixed(4)} ${pos.coin}`;

    const tokenInfo = useMemo(() => {
      return getTokenInfo(pos.coin);
    }, [pos.coin, getTokenInfo]);

    const handleMarketClose = () => {
      if (tokenInfo) {
        console.log('PerpPositionRow handleMarketClose:', {
          coin: pos.coin,
          mid,
          tokenInfo,
        });
        showClosePositionDialog({
          position: pos,
          assetId: tokenInfo.assetId,
          mid,
          hyperliquidActions: actions,
        });
      }
    };

    return (
      <XStack
        flex={1}
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
        {/* Side Indicator */}
        <XStack width={COLUMN_WIDTHS.side} justifyContent="flex-start">
          <XStack
            width="$1"
            height={20}
            bg={side === 'long' ? '$green7' : '$red7'}
          />
        </XStack>

        {/* Symbol & Leverage */}
        <XStack width={COLUMN_WIDTHS.symbol} alignItems="center" space="$2">
          <SizableText size="$bodyMd" fontWeight="600">
            {pos.coin}
          </SizableText>
          <SizableText
            size="$bodySm"
            color={side === 'long' ? '$textSuccess' : '$textCritical'}
            bg={side === 'long' ? '$green3' : '$red3'}
            px="$2"
            py="$1"
            borderRadius="$2"
          >
            {pos.leverage?.value ?? ''}X
          </SizableText>
        </XStack>

        {/* Size */}
        <XStack width={COLUMN_WIDTHS.size} justifyContent="flex-start">
          <SizableText size="$bodyMd">{formattedSize}</SizableText>
        </XStack>

        {/* Entry Price */}
        <XStack width={COLUMN_WIDTHS.entryPrice} justifyContent="flex-start">
          <SizableText size="$bodyMd">
            $
            {entryPrice > 0
              ? formatPriceToSignificantDigits(entryPrice, 5)
              : '0'}
          </SizableText>
        </XStack>

        {/* Mark Price */}
        <XStack width={COLUMN_WIDTHS.markPrice} justifyContent="flex-start">
          <SizableText size="$bodyMd">
            $
            {markPrice !== '0'
              ? formatPriceToSignificantDigits(Number(markPrice), 5)
              : '0'}
          </SizableText>
        </XStack>

        {/* Unrealized PnL */}
        <YStack width={COLUMN_WIDTHS.pnl} alignItems="flex-start">
          <SizableText
            size="$bodyMd"
            color={isProfit ? '$textSuccess' : '$textCritical'}
            fontWeight="600"
          >
            {isProfit ? '+' : '-'}${Math.abs(unrealizedPnl).toFixed(2)}
          </SizableText>
          <SizableText
            size="$bodySm"
            color={isProfit ? '$textSuccess' : '$textCritical'}
          >
            ({isProfit ? '+' : ''}
            {roiPercent.toFixed(2)}%)
          </SizableText>
        </YStack>

        {/* Margin */}
        <XStack width={COLUMN_WIDTHS.margin} justifyContent="flex-start">
          <SizableText size="$bodyMd">${marginUsed.toFixed(2)}</SizableText>
        </XStack>

        {/* Liquidation Price */}
        <XStack width={COLUMN_WIDTHS.liqPrice} justifyContent="flex-start">
          <SizableText
            size="$bodyMd"
            color={displayLiqPrice === 'N/A' ? '$textSubdued' : '$textCritical'}
          >
            {displayLiqPrice}
          </SizableText>
        </XStack>

        {/* Actions */}
        <XStack
          width={COLUMN_WIDTHS.actions}
          space="$2"
          justifyContent="flex-start"
        >
          <Button size="small" variant="secondary" disabled>
            <SizableText size="$bodySm">Limit</SizableText>
          </Button>
          <Button size="small" variant="secondary" onPress={handleMarketClose}>
            <SizableText size="$bodySm">Market</SizableText>
          </Button>
        </XStack>
      </XStack>
    );
  },
  (_prevProps) => {
    return false;
  },
);

PositionRow.displayName = 'PositionRow';
export { PositionRow };
