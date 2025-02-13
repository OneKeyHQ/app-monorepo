import { useCallback, useMemo } from 'react';

import {
  ListView,
  SizableText,
  Skeleton,
  XStack,
  useMedia,
} from '@onekeyhq/components';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import type { IFetchLimitOrderRes } from '@onekeyhq/shared/types/swap/types';

import LimitOrderListItem from '../../components/LimitOrderListItem';

interface ILimitOrderListProps {
  data: IFetchLimitOrderRes[];
  isLoading?: boolean;
}

const LimitOrderList = ({ data, isLoading }: ILimitOrderListProps) => {
  const { gtMd } = useMedia();

  const renderItem = useCallback(
    ({ item }: { item: IFetchLimitOrderRes }) => (
      <LimitOrderListItem
        item={item}
        onClickCell={() => {}}
        onCancel={() => {}}
      />
    ),
    [],
  );

  const listHeaderComponent = useMemo(() => {
    if (gtMd) {
      return (
        <XStack alignItems="center">
          <SizableText size="$bodySm" flex={1}>
            Pair
          </SizableText>
          <SizableText size="$bodySm" w="$40">
            Limit price
          </SizableText>
          <SizableText size="$bodySm" w="$30">
            Status
          </SizableText>
          <SizableText size="$bodySm" flex={1} textAlign="right">
            Expiration | Action
          </SizableText>
        </XStack>
      );
    }
    return (
      <XStack alignItems="center">
        <SizableText size="$bodySm" flex={1}>
          Pair
        </SizableText>
        <SizableText size="$bodySm" w="$25">
          Status
        </SizableText>
        <SizableText size="$bodySm" flex={1} textAlign="right">
          Expiration | Action
        </SizableText>
      </XStack>
    );
  }, [gtMd]);

  const loadingSkeleton = useMemo(
    () =>
      Array.from({ length: gtMd ? 4 : 3 }).map((_, index) => (
        <ListItem key={index}>
          <Skeleton w="$10" h="$10" borderRadius="$2" />
        </ListItem>
      )),
    [gtMd],
  );
  return !data.length && isLoading ? (
    loadingSkeleton
  ) : (
    <ListView
      estimatedItemSize="$20"
      data={data}
      renderItem={renderItem}
      ListHeaderComponent={listHeaderComponent}
    />
  );
};

export default LimitOrderList;
