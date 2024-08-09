import { useCallback, useMemo, useRef } from 'react';

import debounce from 'lodash/debounce';

import type {
  IListViewProps,
  IListViewRef,
  IStackProps,
} from '@onekeyhq/components';
import { useTabScrollViewRef } from '@onekeyhq/components';

export function useTabListScroll<T>({ inTabList }: { inTabList: boolean }) {
  const scrollViewRef = useTabScrollViewRef();
  const listViewRef = useRef<IListViewRef<unknown> | null>(null);
  const listViewInstanceRef = useRef<HTMLDivElement | undefined>(undefined);
  const getListView = useCallback(
    () =>
      {
        if (!listViewInstanceRef.current) {
          const current = (listViewRef.current as {getCurrent?: () => typeof listViewRef.current })?.getCurrent?.() || listViewRef.current
          listViewInstanceRef.current = (
            current as unknown as {
              _listRef?: { _scrollRef: HTMLDivElement };
            }
          )?._listRef?._scrollRef;
        }
        return listViewInstanceRef.current;
      },
    [],
  );

  const onLayout = useCallback(() => {
    const scrollView = scrollViewRef?.current as unknown as HTMLElement;
    let prevListScrollTop = 0;
    const isNearBottom = () =>
      scrollView.scrollTop + scrollView.clientHeight >= scrollView.scrollHeight;

    const onListViewScroll = () => {
      const listView = getListView();
      if (listView && !isNearBottom()) {
        const scrollTop = listView.scrollTop;
        if (prevListScrollTop <= scrollTop) {
          listView.scrollTop = 0;
          scrollView.scrollTop += scrollTop;
        }
        prevListScrollTop = scrollTop;
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

    const onWheel = debounce(
      (event: { deltaY: number; stopPropagation: () => void }) => {
        event.stopPropagation();
        if (isNearBottom()) {
          return;
        }
        const listView = getListView();
        const direction = event.deltaY;
        if (listView?.scrollTop === 0 && direction < 0) {
          scrollView.scrollTop += Math.max(direction, -40);
        }
      },
      5,
    );
    const listView = getListView();
    scrollView?.addEventListener('scroll', onScroll);
    listView?.addEventListener('scroll', onListViewScroll);
    listView?.addEventListener('wheel', onWheel as any);
    return () => {
      scrollView?.removeEventListener('scroll', onScroll);
      listView?.removeEventListener('scroll', onListViewScroll);
      listView?.removeEventListener('wheel', onWheel as any);
    };
  }, [getListView, scrollViewRef]);

  const listViewProps = useMemo(
    () => ({
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
