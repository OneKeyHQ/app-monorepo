import { useCallback, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Image,
  SizableText,
  Skeleton,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { useSwapProTradeTypeAtom } from '@onekeyhq/kit/src/states/jotai/contexts/swap';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { UNAVAILABLE_DISPLAY } from '@onekeyhq/shared/src/utils/tokenValueUtils';
import { ESwapProTradeType } from '@onekeyhq/shared/types/swap/types';

import SwapProTokenTransactionItem, {
  SWAP_PRO_TRANSACTION_ITEM_HEIGHT as ROW_HEIGHT,
} from '../../components/SwapProTokenTransactionItem';
import { SwapTestIDs } from '../../testIDs';
import {
  SWAP_PRO_TRANSACTION_LIMIT,
  getTransactionIdentity,
} from '../../utils/swapProMarketDataUtils';

import type { ISwapProMarketData } from '../../utils/swapProMarketDataUtils';
import type { LayoutChangeEvent } from 'react-native';

// The last row may overhang the container by up to 6px: its 16px text box is
// centered in the 22px row, so the overhang consumes the 3px bottom slack and
// at most ~3px of descender-free box below the digits. Smaller values drop a
// row that visibly fits on real devices.
const LAST_ROW_CLIP_TOLERANCE = 6;

const unsupportedSourceContent = (
  <XStack justifyContent="space-between">
    <SizableText size="$bodySm" color="$textSubdued">
      {UNAVAILABLE_DISPLAY}
    </SizableText>
    <SizableText size="$bodySm" color="$textSubdued">
      {UNAVAILABLE_DISPLAY}
    </SizableText>
  </XStack>
);

const SwapProTokenTransactionList = ({
  marketData,
}: {
  marketData: ISwapProMarketData;
}) => {
  const intl = useIntl();
  const [swapProTradeType] = useSwapProTradeTypeAtom();
  const [listHeight, setListHeight] = useState(0);
  const handleListLayout = useCallback((e: LayoutChangeEvent) => {
    const h = e.nativeEvent.layout.height;
    // Ignore sub-pixel jitter to avoid layout/render feedback loops
    setListHeight((prev) => (Math.abs(prev - h) >= 1 ? h : prev));
  }, []);

  // Baseline row caps per trade-type layout; the list container then flexes
  // into whatever extra height the taller trading column gives this column,
  // and the measured height decides how many extra rows fit.
  const isLimitOrder = swapProTradeType === ESwapProTradeType.LIMIT;
  const baseRows = isLimitOrder ? 9 : 5;
  const maxRows = Math.max(
    baseRows,
    Math.floor((listHeight + LAST_ROW_CLIP_TOLERANCE) / ROW_HEIGHT),
  );
  const finallyTransactionList = useMemo(
    () => marketData.transactions.slice(0, maxRows),
    [marketData.transactions, maxRows],
  );
  let transactionListContent = unsupportedSourceContent;
  // Keep the skeleton up until the initial batch lands, even if websocket
  // trades have already trickled in — the list then fills in one shot instead
  // of growing row by row after a token switch
  if (marketData.isSourceSupported && !marketData.hasLoadedSource) {
    // The data feed never returns more than SWAP_PRO_TRANSACTION_LIMIT rows,
    // so don't render skeletons real data can never fill
    const skeletonRows = Math.min(maxRows, SWAP_PRO_TRANSACTION_LIMIT);
    transactionListContent = (
      <YStack>
        {Array.from({ length: skeletonRows }).map((_, index) => (
          <Skeleton w="100%" h={ROW_HEIGHT} radius="square" key={index} />
        ))}
      </YStack>
    );
  } else if (
    marketData.isSourceSupported &&
    finallyTransactionList.length > 0
  ) {
    transactionListContent = (
      <YStack>
        {finallyTransactionList.map((item) => (
          <SwapProTokenTransactionItem
            key={getTransactionIdentity(item)}
            item={item}
          />
        ))}
      </YStack>
    );
  }
  return (
    <YStack flex={1}>
      <XStack justifyContent="space-between" py="$1">
        <XStack gap="$1" alignItems="center">
          <SizableText size="$bodySm" color="$textSubdued">
            {intl.formatMessage({
              id: ETranslations.global_price,
            })}
          </SizableText>
          {marketData.source === 'hyperliquid' ? (
            <Stack
              w={13}
              h={13}
              overflow="hidden"
              borderRadius={6.5}
              bg="#072723"
              opacity={0.6}
            >
              <Image
                position="absolute"
                left={2}
                top={2}
                w={48}
                h={9}
                contentFit="fill"
                source={require('@onekeyhq/kit/assets/perps/hyperliquid-logo-dark.png')}
              />
            </Stack>
          ) : null}
        </XStack>
        <SizableText size="$bodySm" color="$textSubdued">
          {intl.formatMessage({
            id: ETranslations.global_value,
          })}
        </SizableText>
      </XStack>
      <YStack
        testID={SwapTestIDs.proTransactionList}
        flex={1}
        minHeight={baseRows * ROW_HEIGHT}
        overflow="hidden"
        onLayout={handleListLayout}
      >
        {/* Rows paint into an absolute layer so however many are rendered
            they never feed back into the left column's measured height; the
            trading column alone keeps driving the overall panel height. */}
        <YStack position="absolute" top={0} left={0} right={0}>
          {transactionListContent}
        </YStack>
      </YStack>
    </YStack>
  );
};

export default SwapProTokenTransactionList;
