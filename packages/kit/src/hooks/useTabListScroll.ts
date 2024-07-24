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

  const isBindEvent = useRef(false);
  const getListView = useCallback(
    () =>
      (
        listViewRef.current as unknown as {
          _listRef?: { _scrollRef: HTMLDivElement };
        }
      )?._listRef?._scrollRef,
    [],
  );
  const onLayout = useCallback(() => {
    if (isBindEvent.current) {
      return;
    }
    const MoveEventName = platformEnv.isWebTouchable ? 'touchmove' : 'wheel';
    isBindEvent.current = true;
    if (inTabList && !platformEnv.isNative) {
      let direction = 0;
      const scrollView = scrollViewRef?.current as unknown as HTMLElement;
      // const listView = getListView();
      // const onListViewScroll = () => {
      //   if (!listView) {
      //     return;
      //   }
      //   const { scrollTop } = listView;
      //   if (scrollTop === 0) {
      //     listView.style.overflowY = direction < 0 ? 'scroll' : 'hidden';
      //   }
      // };

      let prevOverFlowY = 'hidden';
      let prevScrollPos = 0;
      const onMoveScroll = (event: any) => {
        if (platformEnv.isWebTouchable) {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          const currentScrollPos = event.changedTouches[0].clientY;
          direction = currentScrollPos - prevScrollPos;
          prevScrollPos = currentScrollPos;
        } else {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          direction = event.wheelDelta;
        }
        const listView = getListView();
        if (listView) {
          const {
            scrollTop: scrollViewScrollTop,
            scrollHeight,
            clientHeight,
          } = scrollView;
          const { scrollTop } = listView;
          const isNearBottom =
            scrollViewScrollTop + clientHeight >= scrollHeight;
          // console.log(scrollTop, isNearBottom, direction);
          if (scrollTop === 0 && isNearBottom) {
            listView.style.overflowY = direction < 0 ? 'scroll' : 'hidden';
            if (
              prevOverFlowY === 'hidden' &&
              listView.style.overflowY === 'scroll'
            ) {
              listView.scrollTo({
                top: Math.abs(direction),
                behavior: 'smooth',
              });
            }
            prevOverFlowY = listView.style.overflowY;
          }
        }
      };

      const onScroll = () => {
        const { scrollTop, scrollHeight, clientHeight } = scrollView;
        const isNearBottom = scrollTop + clientHeight >= scrollHeight;
        const listView = getListView();
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

      const listView = getListView();
      scrollView?.addEventListener('scroll', onScroll);
      // listView?.addEventListener('scroll', onListViewScroll);
      listView?.addEventListener(MoveEventName, onMoveScroll as any);
      return () => {
        scrollView?.removeEventListener('scroll', onScroll);
        // listView?.removeEventListener('scroll', onListViewScroll);
        listView?.removeEventListener(MoveEventName, onMoveScroll as any);
      };
    }
  }, [scrollViewRef, inTabList, getListView]);

  const listViewProps = useMemo(
    () =>
      platformEnv.isNative
        ? {}
        : ({
            style: inTabList
              ? ({
                  overflowY: 'hidden',
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
