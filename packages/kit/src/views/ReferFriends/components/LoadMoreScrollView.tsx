import { ScrollView } from '@onekeyhq/components';
import type { IScrollViewProps } from '@onekeyhq/components';

import { useScrollViewLoadMore } from '../hooks/useScrollViewLoadMore';

type ILoadMoreScrollViewProps = Omit<
  IScrollViewProps,
  'onScroll' | 'onLayout' | 'onContentSizeChange'
> &
  Parameters<typeof useScrollViewLoadMore>[0];

// Keeps the pagination metrics tied to this ScrollView instance, so a
// remounted list starts from fresh measurements.
export function LoadMoreScrollView({
  cursor,
  isLoading,
  itemCount,
  listVersion,
  onLoadMore,
  threshold,
  ...scrollViewProps
}: ILoadMoreScrollViewProps) {
  const loadMoreProps = useScrollViewLoadMore({
    cursor,
    isLoading,
    itemCount,
    listVersion,
    onLoadMore,
    threshold,
  });
  return (
    <ScrollView
      scrollEventThrottle={16}
      {...scrollViewProps}
      {...loadMoreProps}
    />
  );
}
