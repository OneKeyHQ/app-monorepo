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
  const { swapProTokenTransactionList, isRefreshing } =
    useSwapProTokenTransactionList(
      swapProSelectToken?.contractAddress ?? '',
      swapProSelectToken?.networkId ?? '',
      Boolean(enableWebSocket),
      supportSpeedSwap,
    );

  const finallyTransactionList = useMemo(() => {
    if (swapProTradeType === ESwapProTradeType.LIMIT) {
      return swapProTokenTransactionList?.slice(0, 8) ?? [];
    }
    return swapProTokenTransactionList?.slice(0, 5) ?? [];
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
      {!supportSpeedSwap ? (
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
                ? Array.from({ length: 5 }).map((_, index) => (
                    <Skeleton w="100%" h={22} radius="square" key={index} />
                  ))
                : Array.from({ length: 8 }).map((_, index) => (
                    <Skeleton w="100%" h={22} radius="square" key={index} />
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
