import { useMemo } from 'react';

import { useIntl } from 'react-intl';

import { SizableText, Skeleton, XStack, YStack } from '@onekeyhq/components';
import {
  useSwapProSelectTokenAtom,
  useSwapProTokenDetailWebsocketAtom,
  useSwapTypeSwitchAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/swap';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { ESwapTabSwitchType } from '@onekeyhq/shared/types/swap/types';

import SwapProTokenTransactionItem from '../../components/SwapProTokenTransactionItem';
import { useSwapProTokenTransactionList } from '../../hooks/useSwapPro';

const SwapProTokenTransactionList = () => {
  const intl = useIntl();
  const [swapProSelectToken] = useSwapProSelectTokenAtom();
  const [swapTypeSwitch] = useSwapTypeSwitchAtom();
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
  return (
    <YStack gap="$1" mb="$1">
      <XStack justifyContent="space-between" mb="$2">
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
      {isRefreshing ||
      !swapProTokenTransactionList ||
      swapProTokenTransactionList.length === 0 ? (
        <YStack gap="$1.5">
          <Skeleton w="100%" h="$4" radius="square" />
          <Skeleton w="100%" h="$4" radius="square" />
          <Skeleton w="100%" h="$4" radius="square" />
          <Skeleton w="100%" h="$4" radius="square" />
        </YStack>
      ) : (
        <YStack gap="$1.5">
          {swapProTokenTransactionList.map((item, index) => (
            <SwapProTokenTransactionItem
              key={`${item.hash}-${index}`}
              item={item}
            />
          ))}
        </YStack>
      )}
    </YStack>
  );
};

export default SwapProTokenTransactionList;
