import { ScrollView, SizableText, XStack, YStack } from '@onekeyhq/components';
import {
  useAllMidsAtom,
  useHyperliquidActions,
} from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid';

import { usePerpPositions } from '../../../hooks/usePerpOrderInfoPanel';
import { PositionRow } from '../Components/PositionsRow';

// Fixed column widths for consistent table layout
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

function PerpPositionsList() {
  const positions = usePerpPositions();
  const [allMids] = useAllMidsAtom();
  const actions = useHyperliquidActions();
  const totalWidth = Object.values(COLUMN_WIDTHS).reduce(
    (sum, width) => sum + width,
    0,
  );

  if (!positions.length) {
    return (
      <YStack flex={1} justifyContent="center" alignItems="center" p="$6">
        <SizableText size="$bodyMd" color="$textSubdued" textAlign="center">
          No open positions
        </SizableText>
        <SizableText
          size="$bodySm"
          color="$textSubdued"
          textAlign="center"
          mt="$2"
        >
          Your positions will appear here after opening trades
        </SizableText>
      </YStack>
    );
  }

  return (
    <YStack flex={1} overflow="hidden">
      {/* Column Headers */}
      <XStack
        flex={1}
        py="$2"
        px="$3"
        minWidth={totalWidth}
        borderBottomWidth="$px"
        borderBottomColor="$borderSubdued"
        bg="$bgSubtle"
      >
        <XStack width={COLUMN_WIDTHS.side} />
        <XStack width={COLUMN_WIDTHS.symbol}>
          <SizableText size="$bodySm" color="$textSubdued" fontWeight="600">
            Symbol
          </SizableText>
        </XStack>
        <XStack width={COLUMN_WIDTHS.size}>
          <SizableText size="$bodySm" color="$textSubdued" fontWeight="600">
            Size
          </SizableText>
        </XStack>
        <XStack width={COLUMN_WIDTHS.entryPrice}>
          <SizableText size="$bodySm" color="$textSubdued" fontWeight="600">
            Entry Price
          </SizableText>
        </XStack>
        <XStack width={COLUMN_WIDTHS.markPrice}>
          <SizableText size="$bodySm" color="$textSubdued" fontWeight="600">
            Mark Price
          </SizableText>
        </XStack>
        <XStack width={COLUMN_WIDTHS.pnl}>
          <SizableText size="$bodySm" color="$textSubdued" fontWeight="600">
            PnL (ROE %)
          </SizableText>
        </XStack>
        <XStack width={COLUMN_WIDTHS.margin}>
          <SizableText size="$bodySm" color="$textSubdued" fontWeight="600">
            Margin
          </SizableText>
        </XStack>
        <XStack width={COLUMN_WIDTHS.liqPrice}>
          <SizableText size="$bodySm" color="$textSubdued" fontWeight="600">
            Liq. Price
          </SizableText>
        </XStack>
        <XStack width={COLUMN_WIDTHS.actions}>
          <SizableText size="$bodySm" color="$textSubdued" fontWeight="600">
            Close
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
        <YStack flex={1}>
          {positions.map(({ position }) => {
            const midValue = allMids?.mids?.[position.coin];
            return (
              <PositionRow
                key={`${position.coin}_${position.szi}`}
                pos={position}
                mid={midValue}
                actions={actions}
              />
            );
          })}
        </YStack>
      </ScrollView>
    </YStack>
  );
}

export { PerpPositionsList };
