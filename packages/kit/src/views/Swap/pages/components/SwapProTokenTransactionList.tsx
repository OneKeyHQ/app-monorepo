import { useMemo } from 'react';

import { useIntl } from 'react-intl';

import { SizableText, Skeleton, XStack, YStack } from '@onekeyhq/components';
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
import { useSwapProTokenTransactionList } from '../../hooks/useSwapPro';

const SwapProTokenTransactionList = () => {
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
  const { swapProTokenTransactionList, isRefreshing } =
    useSwapProTokenTransactionList(
      swapProSelectToken?.contractAddress ?? '',
      swapProSelectToken?.networkId ?? '',
      Boolean(enableWebSocket),
    );

  const finallyTransactionList = useMemo(() => {
    if (swapProTradeType === ESwapProTradeType.LIMIT) {
      return swapProTokenTransactionList?.slice(0, 10) ?? [];
    }
    return swapProTokenTransactionList?.slice(0, 4) ?? [];
  }, [swapProTokenTransactionList, swapProTradeType]);
  return (
    <YStack>
      <XStack justifyContent="space-between" py="$1">
        <SizableText size="$bodySm" color="$textSubdued">
          {intl.formatMessage({
            id: ETranslations.global_price,
          })}
        </SizableText>
        <SizableText size="$bodySm" color="$textSubdued">
          {intl.formatMessage({
            id: ETranslations.global_value,
          })}
        </SizableText>
      </XStack>
      {swapProSelectToken?.isNative ? (
        <XStack justifyContent="space-between">
          <SizableText size="$bodySm" color="$textSubdued">
            --
          </SizableText>
          <SizableText size="$bodySm" color="$textSubdued">
            --
          </SizableText>
        </XStack>
      ) : (
        <>
          {isRefreshing ||
          !finallyTransactionList ||
          finallyTransactionList.length === 0 ? (
            <YStack>
              {swapProTradeType === ESwapProTradeType.MARKET
                ? Array.from({ length: 4 }).map((_, index) => (
                    <Skeleton
                      w="100%"
                      h="$6"
                      radius="square"
                      py="$1"
                      key={index}
                    />
                  ))
                : Array.from({ length: 10 }).map((_, index) => (
                    <Skeleton
                      w="100%"
                      h="$6"
                      radius="square"
                      py="$1"
                      key={index}
                    />
                  ))}
            </YStack>
          ) : (
            <YStack>
              {finallyTransactionList.map((item, index) => (
                <SwapProTokenTransactionItem
                  key={`${item.hash}-${index}`}
                  item={item}
                />
              ))}
            </YStack>
          )}
        </>
      )}
    </YStack>
  );
};

export default SwapProTokenTransactionList;
