import { useMemo } from 'react';

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

const SwapProTokenTransactionList = ({
  marketData,
}: {
  marketData: ISwapProMarketData;
}) => {
  const intl = useIntl();
  const [swapProTradeType] = useSwapProTradeTypeAtom();

  // Row caps tuned so the left column bottom-aligns with the trading column
  // in each trade-type layout; the loading skeleton uses the same counts.
  const isLimitOrder = swapProTradeType === ESwapProTradeType.LIMIT;
  const maxRows = isLimitOrder ? 9 : 5;
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
    <YStack>
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
      <YStack testID={SwapTestIDs.proTransactionList} minHeight={maxRows * 22}>
        {transactionListContent}
      </YStack>
    </YStack>
  );
};

export default SwapProTokenTransactionList;
