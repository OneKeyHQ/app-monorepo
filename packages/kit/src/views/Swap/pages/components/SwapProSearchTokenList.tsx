import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import { Empty, ListView, Skeleton, YStack } from '@onekeyhq/components';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IMarketSearchV2Token } from '@onekeyhq/shared/types/market';

import SwapProSearchTokenListItem from './SwapProSearchTokenListItem';

interface ISwapProSearchTokenListProps {
  items: (IMarketSearchV2Token & { networkLogoURI: string })[];
  onPress: (item: IMarketSearchV2Token & { networkLogoURI: string }) => void;
  isLoading?: boolean;
}
const SwapProSearchTokenList = ({
  items,
  onPress,
  isLoading,
}: ISwapProSearchTokenListProps) => {
  const intl = useIntl();
  const renderItem = useCallback(
    ({ item }: { item: IMarketSearchV2Token & { networkLogoURI: string } }) => (
      <SwapProSearchTokenListItem item={item} onPress={onPress} />
    ),
    [onPress],
  );
  if (isLoading) {
    return (
      <ListItem>
        <Skeleton w="$10" h="$10" radius="round" />
        <YStack>
          <Skeleton h="$4" w="$32" />
          <Skeleton h="$3" w="$24" />
        </YStack>
      </ListItem>
    );
  }
  return (
    <ListView
      data={items}
      renderItem={renderItem}
      ListEmptyComponent={
        <Empty
          icon="SearchOutline"
          title={intl.formatMessage({
            id: ETranslations.global_no_results,
          })}
        />
      }
    />
  );
};

export default SwapProSearchTokenList;
