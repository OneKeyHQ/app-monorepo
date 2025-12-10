import { useCallback, useMemo } from 'react';

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
  useSwapProEnableCurrentSymbolAtom,
  useSwapProSelectTokenAtom,
  useSwapProSupportNetworksTokenListAtom,
  useSwapProSupportNetworksTokenListLoadingAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/swap';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { equalTokenNoCaseSensitive } from '@onekeyhq/shared/src/utils/tokenUtils';
import type { ISwapToken } from '@onekeyhq/shared/types/swap/types';

import SwapProPositionItem from '../../components/SwapProPositionItem';

interface ISwapProPositionsListProps {
  onTokenPress: (token: ISwapToken) => void;
}

const ItemSeparatorComponent = () => <Divider />;

const SwapProPositionsList = ({ onTokenPress }: ISwapProPositionsListProps) => {
  const intl = useIntl();
  const [swapProSupportNetworksTokenList] =
    useSwapProSupportNetworksTokenListAtom();
  const [swapProSupportNetworksTokenListLoading] =
    useSwapProSupportNetworksTokenListLoadingAtom();
  const [swapProEnableCurrentSymbol] = useSwapProEnableCurrentSymbolAtom();
  const [swapProTokenSelect] = useSwapProSelectTokenAtom();

  const filteredTokenList = useMemo(() => {
    if (swapProEnableCurrentSymbol) {
      return swapProSupportNetworksTokenList.filter((token) =>
        equalTokenNoCaseSensitive({
          token1: token,
          token2: swapProTokenSelect,
        }),
      );
    }
    return swapProSupportNetworksTokenList;
  }, [
    swapProEnableCurrentSymbol,
    swapProSupportNetworksTokenList,
    swapProTokenSelect,
  ]);

  const renderItem = useCallback(
    ({ item }: { item: ISwapToken }) => (
      <SwapProPositionItem token={item} onPress={onTokenPress} />
    ),
    [onTokenPress],
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
      data={filteredTokenList}
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
