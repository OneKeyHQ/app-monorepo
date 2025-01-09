import { useCallback, useMemo, useRef } from 'react';

import debounce from 'lodash/debounce';

import type {
  IListViewProps,
  IListViewRef,
  IStackProps,
} from '@onekeyhq/components';
import { useTabScrollViewRef } from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

export function useTabListScroll<T>({ inTabList }: { inTabList: boolean }) {
  const isMac = useMemo(() => platformEnv.isRuntimeMacOSBrowser, []);
  const scrollViewRef = useTabScrollViewRef();
  const listViewRef = useRef<IListViewRef<unknown> | null>(null);
  const listViewInstanceRef = useRef<HTMLDivElement | undefined>(undefined);
  const getListView = useCallback(() => {
    if (!listViewInstanceRef.current) {
      const current = listViewRef.current;
      listViewInstanceRef.current = (
        current as unknown as {
          _listRef?: { _scrollRef: HTMLDivElement };
        }
      )?._listRef?._scrollRef;
    }
    return listViewInstanceRef.current;
  }, []);

  const onLayout = useCallback(() => {
    const scrollView = scrollViewRef?.current as unknown as HTMLElement;
    let prevListScrollTop = 0;
    // When using scaling settings in Windows, the element height and scroll distance may be floating-point numbers, which can lead to errors in calculations.
    //  Therefore, use a method where the absolute value is less than 1 to eliminate the error.
    const isNearBottom = () =>
      scrollView &&
      Math.abs(
        scrollView.scrollTop +
          scrollView.clientHeight -
          scrollView.scrollHeight,
      ) <= 1;

    const onListViewScroll = () => {
      const listView = getListView();
      if (listView && !isNearBottom()) {
        const scrollTop = listView.scrollTop;
        if (scrollView && prevListScrollTop <= scrollTop) {
          listView.scrollTop = 0;
          scrollView.scrollTop += scrollTop;
        }
        prevListScrollTop = scrollTop;
      }
    };

    let prevScrollTop = 0;
    let isListViewWheeling = false;
    let listViewTimerId: ReturnType<typeof setTimeout> | undefined;
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

    const onScrollViewWheel = debounce(
      (event: { deltaY: number; stopPropagation: () => void }) => {
        const deltaY = event.deltaY;
        if (isListViewWheeling) {
          return;
        }

        if (deltaY > 0 && isNearBottom()) {
          const listView = getListView();
          if (listView) {
            listView.scrollTop += Math.min(deltaY, 40);
          }
        }
      },
      5,
    );

    const onWheel = debounce(
      (event: { deltaY: number; stopPropagation: () => void }) => {
        isListViewWheeling = true;
        clearTimeout(listViewTimerId);
        listViewTimerId = setTimeout(() => {
          isListViewWheeling = false;
        }, 50);
        event.stopPropagation();
        const listView = getListView();
        const direction = event.deltaY;
        if (isNearBottom()) {
          if (isMac) {
            return;
          }

          if (listView?.scrollTop !== 0) {
            return;
          }
        }
        if (listView?.scrollTop === 0 && scrollView) {
          if (direction < 0) {
            scrollView.scrollTop += Math.max(direction, -40);
          } else if (!isMac) {
            scrollView.scrollTop += Math.min(direction, 40);
          }
        }
      },
      5,
    );
    const listView = getListView();
    scrollView?.addEventListener('scroll', onScroll);
    if (!isMac) {
      scrollView?.addEventListener('wheel', onScrollViewWheel as any);
    }
    listView?.addEventListener('scroll', onListViewScroll);
    listView?.addEventListener('wheel', onWheel as any);
    return () => {
      scrollView?.removeEventListener('scroll', onScroll);
      if (!isMac) {
        scrollView?.removeEventListener('wheel', onScrollViewWheel as any);
      }
      listView?.removeEventListener('scroll', onListViewScroll);
      listView?.removeEventListener('wheel', onWheel as any);
    };
  }, [getListView, isMac, scrollViewRef]);

  const listViewProps = useMemo(
    () =>
      ({
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
