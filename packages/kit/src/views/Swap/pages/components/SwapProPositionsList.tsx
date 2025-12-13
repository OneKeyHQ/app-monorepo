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
import { useSwapProSupportNetworksTokenListLoadingAtom } from '@onekeyhq/kit/src/states/jotai/contexts/swap';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { ISwapToken } from '@onekeyhq/shared/types/swap/types';

import SwapProPositionItem from '../../components/SwapProPositionItem';
import { useSwapProPositionsListFilter } from '../../hooks/useSwapPro';

interface ISwapProPositionsListProps {
  onTokenPress: (token: ISwapToken) => void;
}

const ItemSeparatorComponent = () => <Divider />;

const SwapProPositionsList = ({ onTokenPress }: ISwapProPositionsListProps) => {
  const intl = useIntl();
  const { finallyTokenList } = useSwapProPositionsListFilter();
  const [swapProSupportNetworksTokenListLoading] =
    useSwapProSupportNetworksTokenListLoadingAtom();

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
      data={finallyTokenList}
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
