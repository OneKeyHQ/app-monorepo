import { useCallback, useMemo, useRef } from 'react';

import type {
  IListViewProps,
  IListViewRef,
  IStackProps,
} from '@onekeyhq/components';
import { useTabScrollViewRef } from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

export function useTabListScroll<T>({
  onContentSizeChange,
  inTabList,
}: {
  onContentSizeChange: IListViewProps<T>['onContentSizeChange'];
  inTabList: boolean;
}) {
  const scrollViewRef = useTabScrollViewRef();
  const listViewRef = useRef<IListViewRef<unknown> | null>(null);

  const isBindEvent = useRef(false);
  const onLayout = useCallback(() => {
    if (isBindEvent.current) {
      return;
    }
    isBindEvent.current = true;
    if (inTabList && !platformEnv.isNative) {
      let direction = 0;
      const scrollView = scrollViewRef?.current as unknown as HTMLElement;
      const listView = (
        listViewRef.current as unknown as {
          _listRef?: { _scrollRef: HTMLDivElement };
        }
      )?._listRef?._scrollRef;
      const onListViewScroll = () => {
        if (!listView) {
          return;
        }
        const { scrollTop } = listView;
        if (scrollTop === 0) {
          listView.style.overflowY = direction < 0 ? 'scroll' : 'hidden';
        }
      };

      const onWheelScroll = ({ wheelDelta }: { wheelDelta: number }) => {
        direction = wheelDelta;
        if (listView) {
          const {
            scrollTop: scrollViewScrollTop,
            scrollHeight,
            clientHeight,
          } = scrollView;
          const { scrollTop } = listView;
          const isNearBottom =
            scrollViewScrollTop + clientHeight >= scrollHeight;
          console.log(scrollTop, isNearBottom, direction);
          if (scrollTop === 0 && isNearBottom && direction < 0) {
            listView.style.overflowY = 'scroll';
          }
        }
      };

      const onScroll = () => {
        const { scrollTop, scrollHeight, clientHeight } = scrollView;
        const isNearBottom = scrollTop + clientHeight >= scrollHeight;
        if (listView) {
          if (isNearBottom) {
            listView.style.overflowY = 'scroll';
          } else {
            listView.style.overflowY = 'hidden';
            setTimeout(() => {
              if (listView) {
                listView.scrollTop = 0;
              }
            }, 10);
          }
        }
      };

      scrollView?.addEventListener('scroll', onScroll);
      listView?.addEventListener('scroll', onListViewScroll);
      listView?.addEventListener('wheel', onWheelScroll as any);
      return () => {
        scrollView?.removeEventListener('scroll', onScroll);
        listView?.removeEventListener('scroll', onListViewScroll);
        listView?.removeEventListener('wheel', onWheelScroll as any);
      };
    }
  }, [scrollViewRef, inTabList]);

  const listViewProps = useMemo(
    () =>
      platformEnv.isNative
        ? ({ onContentSizeChange } as IListViewProps<T>)
        : ({
            style: inTabList
              ? ({
                  overflowY: 'hidden',
                } as IStackProps['style'])
              : undefined,
          } as IListViewProps<T>),
    [onContentSizeChange, inTabList],
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
