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
import {
  useSwapProSelectTokenAtom,
  useSwapProTokenDetailWebsocketAtom,
  useSwapProTradeTypeAtom,
  useSwapTypeSwitchAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/swap';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import {
  ESwapProTradeType,
  ESwapTabSwitchType,
} from '@onekeyhq/shared/types/swap/types';

import SwapProTokenTransactionItem from '../../components/SwapProTokenTransactionItem';
import { useSwapProTokenTransactionList } from '../../hooks/useSwapProTokenTransactionList';

const SwapProTokenTransactionList = ({
  supportSpeedSwap,
}: {
  supportSpeedSwap?: boolean;
}) => {
  const intl = useIntl();
  const [swapProSelectToken] = useSwapProSelectTokenAtom();
  const [swapTypeSwitch] = useSwapTypeSwitchAtom();
  const [swapProTradeType] = useSwapProTradeTypeAtom();
  const [swapProTokenWebsocket] = useSwapProTokenDetailWebsocketAtom();
  const enableWebSocket = useMemo(() => {
    return (
      swapProTokenWebsocket?.txs && swapTypeSwitch === ESwapTabSwitchType.LIMIT
    );
  }, [swapProTokenWebsocket?.txs, swapTypeSwitch]);
  const {
    swapProTokenTransactionList,
    isTransactionSourceSupported,
    isHyperliquidTransactionSource,
    hasLoadedTransactionSource,
  } = useSwapProTokenTransactionList({
    tokenAddress: swapProSelectToken?.contractAddress ?? '',
    networkId: swapProSelectToken?.networkId ?? '',
    symbol: swapProSelectToken?.symbol ?? '',
    isNative: swapProSelectToken?.isNative,
    enableWebSocket: Boolean(enableWebSocket),
    supportSpeedSwap,
  });

  // Row caps tuned so the left column bottom-aligns with the trading column
  // in each trade-type layout; the loading skeleton uses the same counts.
  const isLimitOrder = swapProTradeType === ESwapProTradeType.LIMIT;
  const maxRows = isLimitOrder ? 9 : 5;
  const finallyTransactionList = useMemo(
    () => swapProTokenTransactionList?.slice(0, maxRows) ?? [],
    [swapProTokenTransactionList, maxRows],
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
    isTransactionSourceSupported &&
    !hasLoadedTransactionSource &&
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
    isTransactionSourceSupported &&
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
          {isHyperliquidTransactionSource ? (
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
      <YStack minHeight={maxRows * 22}>{transactionListContent}</YStack>
    </YStack>
  );
};

export default SwapProTokenTransactionList;
