import { useCallback, useMemo, useRef } from 'react';

import type {
  IListViewProps,
  IListViewRef,
  IStackProps,
} from '@onekeyhq/components';
import { useTabScrollViewRef } from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

export function useTabListScroll<T>({ inTabList }: { inTabList: boolean }) {
  const scrollViewRef = useTabScrollViewRef();
  const listViewRef = useRef<IListViewRef<unknown> | null>(null);
  const getListView = useCallback(
    () =>
      (
        listViewRef.current as unknown as {
          _listRef?: { _scrollRef: HTMLDivElement };
        }
      )?._listRef?._scrollRef,
    [],
  );
  const scrollView = scrollViewRef?.current as unknown as HTMLElement;
  const onLayout = useCallback(() => {
    const onListViewScroll = () => {
      const listView = getListView();
      const isNearBottom =
        scrollView.scrollTop + scrollView.clientHeight >=
        scrollView.scrollHeight;
      if (listView && !isNearBottom) {
        const scrollTop = listView.scrollTop;
        listView.scrollTop = 0;
        scrollView.scrollTop += scrollTop;
      }
    };

    let prevScrollTop = 0;
    const onScroll = () => {
      const scrollTop = scrollView.scrollTop;
      if (scrollTop < prevScrollTop) {
        const listView = getListView();
        if (listView) {
          listView.scrollTop = 0;
        }
      }
      prevScrollTop = scrollTop;
    };
    const listView = getListView();
    scrollView?.addEventListener('scroll', onScroll);
    listView?.addEventListener('scroll', onListViewScroll);
  }, [getListView, scrollView]);

  const listViewProps = useMemo(
    () =>
      platformEnv.isNative
        ? {}
        : ({
            style: inTabList
              ? ({
                  minHeight: 100,
                } as IStackProps['style'])
              : undefined,
          } as IListViewProps<T>),
    [inTabList],
  );
  return useMemo(
    () => ({
      onLayout,
      listViewProps,
      listViewRef,
    }),
    [listViewProps, onLayout],
  );
}
