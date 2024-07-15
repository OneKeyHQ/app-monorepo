import { useEffect, useMemo, useRef } from 'react';

import type {
  IListViewProps,
  IListViewRef,
  IStackProps,
} from '@onekeyhq/components';
import { useTabScrollViewRef } from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

export function useTabListProps<T>({
  onContentSizeChange,
}: {
  onContentSizeChange: IListViewProps<T>['onContentSizeChange'];
}) {
  const scrollViewRef = useTabScrollViewRef();
  const listViewRef = useRef<IListViewRef<unknown> | null>(null);

  useEffect(() => {
    if (!platformEnv.isNative) {
      let lastScrollTop = 0;
      let isBindListViewEvent = false;
      let listView: HTMLDivElement | undefined;
      const scrollView = scrollViewRef?.current as unknown as HTMLElement;
      const onListViewScroll = () => {
        // If lastScrollTop >= scrollTop, it means the listView is scrolling up.
        if (!listView) {
          return;
        }
        const { scrollTop } = listView;
        if (lastScrollTop >= scrollTop && scrollTop === 0) {
          listView.style.overflowY = 'hidden';
        }
        lastScrollTop = scrollTop <= 0 ? 0 : scrollTop;
      };
      const onScroll = () => {
        if (!isBindListViewEvent) {
          isBindListViewEvent = true;
          listView = (
            listViewRef.current as unknown as {
              _listRef?: { _scrollRef: HTMLDivElement };
            }
          )?._listRef?._scrollRef;
          if (listView) {
            listView?.addEventListener('scroll', onListViewScroll);
          }
        }
        const { scrollTop, scrollHeight, clientHeight } = scrollView;
        const isNearBottom = scrollTop + clientHeight >= scrollHeight;
        if (listView) {
          if (isNearBottom) {
            listView.style.overflowY = 'scroll';
          } else {
            listView.style.overflowY = 'hidden';
          }
        }
      };

      scrollView?.addEventListener('scroll', onScroll);
      return () => {
        scrollView?.removeEventListener('scroll', onScroll);
        listView?.removeEventListener('scroll', onListViewScroll);
      };
    }
  }, [scrollViewRef]);

  const listViewProps = useMemo(
    () =>
      platformEnv.isNative
        ? ({ onContentSizeChange } as IListViewProps<T>)
        : ({
            style: {
              overflowY: 'hidden',
            } as IStackProps['style'],
          } as IListViewProps<T>),
    [onContentSizeChange],
  );
  return useMemo(
    () => ({
      listViewProps,
      listViewRef,
    }),
    [listViewProps],
  );
}
