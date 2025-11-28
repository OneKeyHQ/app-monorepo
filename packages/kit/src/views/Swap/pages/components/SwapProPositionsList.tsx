import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import {
  Divider,
  Empty,
  ListView,
  Skeleton,
  XStack,
  YStack,
} from '@onekeyhq/components';
import {
  useSwapProSelectTokenAtom,
  useSwapProSupportNetworksTokenListAtom,
  useSwapProSupportNetworksTokenListLoadingAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/swap';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { ISwapToken } from '@onekeyhq/shared/types/swap/types';

import SwapProPositionItem from '../../components/SwapProPositionItem';

const ItemSeparatorComponent = () => <Divider />;

const SwapProPositionsList = () => {
  const intl = useIntl();
  const [swapProSupportNetworksTokenList] =
    useSwapProSupportNetworksTokenListAtom();
  const [swapProSupportNetworksTokenListLoading] =
    useSwapProSupportNetworksTokenListLoadingAtom();
  const [, setSwapProSelectToken] = useSwapProSelectTokenAtom();
  const onPositionTokenPress = useCallback(
    (token: ISwapToken) => {
      setSwapProSelectToken({
        networkId: token.networkId,
        contractAddress: token.contractAddress,
        decimals: token.decimals,
        symbol: token.symbol,
        logoURI: token.logoURI,
        networkLogoURI: token.networkLogoURI,
        name: token.name,
        isNative: token.isNative,
        price: token.price?.toString(),
      });
    },
    [setSwapProSelectToken],
  );
  const renderItem = useCallback(
    ({ item }: { item: ISwapToken }) => (
      <SwapProPositionItem token={item} onPress={onPositionTokenPress} />
    ),
    [onPositionTokenPress],
  );
  if (swapProSupportNetworksTokenListLoading) {
    return (
      <YStack gap="$2" p="$4">
        <XStack>
          <Skeleton w="$20" h="$8" radius="round" />
        </XStack>
        <XStack justifyContent="space-between">
          <Skeleton w="$20" h="$5" radius="round" />
          <Skeleton w="$10" h="$5" radius="round" />
        </XStack>
      </YStack>
    );
  }
  return (
    <ListView
      data={swapProSupportNetworksTokenList}
      renderItem={renderItem}
      ItemSeparatorComponent={ItemSeparatorComponent}
      ListEmptyComponent={
        <Empty
          icon="SearchOutline"
          title={intl.formatMessage({ id: ETranslations.global_no_results })}
        />
      }
    />
  );
};

export default SwapProPositionsList;
