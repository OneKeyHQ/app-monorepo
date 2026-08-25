import { useMemo, useState } from 'react';

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
import { ESwapProTradeType } from '@onekeyhq/shared/types/swap/types';

import SwapProTokenTransactionItem from '../../components/SwapProTokenTransactionItem';
import { SwapTestIDs } from '../../testIDs';

import type { ISwapProMarketData } from '../../utils/swapProMarketDataUtils';

const ROW_HEIGHT = 22;

const SwapProTokenTransactionList = ({
  marketData,
}: {
  marketData: ISwapProMarketData;
}) => {
  const intl = useIntl();
  const [swapProTradeType] = useSwapProTradeTypeAtom();
  const [listHeight, setListHeight] = useState(0);

  // Baseline row caps per trade-type layout; the list container then flexes
  // into whatever extra height the taller trading column gives this column,
  // and the measured height decides how many extra rows fit.
  const isLimitOrder = swapProTradeType === ESwapProTradeType.LIMIT;
  const baseRows = isLimitOrder ? 9 : 5;
  const maxRows = Math.max(baseRows, Math.floor(listHeight / ROW_HEIGHT));
  const finallyTransactionList = useMemo(
    () => marketData.transactions.slice(0, maxRows),
    [marketData.transactions, maxRows],
  );
  let transactionListContent = (
    <XStack justifyContent="space-between">
      <SizableText size="$bodySm" color="$textSubdued">
        --
      </SizableText>
      <SizableText size="$bodySm" color="$textSubdued">
        --
      </SizableText>
    </XStack>
  );
  if (
    marketData.isSourceSupported &&
    !marketData.hasLoadedSource &&
    finallyTransactionList.length === 0
  ) {
    transactionListContent = (
      <YStack>
        {Array.from({ length: maxRows }).map((_, index) => (
          <Skeleton w="100%" h={22} radius="square" key={index} />
        ))}
      </YStack>
    );
  } else if (
    marketData.isSourceSupported &&
    finallyTransactionList.length > 0
  ) {
    transactionListContent = (
      <YStack>
        {finallyTransactionList.map((item, index) => (
          <SwapProTokenTransactionItem
            key={`${item.hash}-${index}`}
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
        onLayout={(e) => {
          const h = e.nativeEvent.layout.height;
          // Ignore sub-pixel jitter to avoid layout/render feedback loops
          setListHeight((prev) => (Math.abs(prev - h) > 1 ? h : prev));
        }}
      >
        {transactionListContent}
      </YStack>
    </YStack>
  );
};

export default SwapProTokenTransactionList;
