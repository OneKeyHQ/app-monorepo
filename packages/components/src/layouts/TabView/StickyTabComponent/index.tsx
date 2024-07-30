import {
  createContext,
  createRef,
  memo,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { RefObject } from 'react';

import { PageManager } from '@onekeyfe/react-native-tab-page-view';
import { Animated } from 'react-native';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { Stack } from '../../../primitives';
import { ScrollView } from '../../ScrollView';
import { FreezeContainer } from '../FreezeContainer';
import { Header } from '../Header';
import { RefreshingFocusedContainer } from '../RefreshingFocused';

import type { ITabPageType, ITabProps } from './types';
import type { IScrollViewRef } from '../../ScrollView';
import type { IFreezeContainerRef } from '../FreezeContainer';
import type { IRefreshingFocusedContainerRef } from '../RefreshingFocused';

const TabScrollViewRefContext = createContext<RefObject<IScrollViewRef | null>>(
  {
    get current() {
      if (platformEnv.isDev) {
        console.warn(
          'Warning: tried to use a ScrollView ref from outside a scrollable context',
        );
      }
      return null;
    },
  },
);
const TabScrollViewRefProvider = memo(TabScrollViewRefContext.Provider);

export const useTabScrollViewRef = () => useContext(TabScrollViewRefContext);

/* eslint-disable react/prop-types */
export const TabComponent = (
  {
    data,
    initialScrollIndex = 0,
    ListHeaderComponent,
    headerProps,
    contentItemWidth,
    contentWidth,
    onSelectedPageIndex,
    shouldSelectedPageIndex,
    tabContentContainerStyle,
    ...props
  }: ITabProps,
  // fix missing forwardRef warnings.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _: any,
) => {
  const scrollViewRef = useRef<IScrollViewRef | null>(null);
  const pageContainerRef = useRef<any | null>(null);
  const scrollViewHeight = useRef(0);
  const headerViewHeight = useRef(0);
  const stickyConfig = useMemo(
    () => ({
      lastIndex: initialScrollIndex,
      data: new Array(data?.length ?? 0).fill({}).map(() => ({
        /* eslint-enable react/prop-types */
        freezeRef: createRef<IFreezeContainerRef>(),
        refreshingFocusedRef: createRef<IRefreshingFocusedContainerRef>(),
      })),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data, initialScrollIndex],
  );
  const [contentHeight, setContentHeight] = useState<number | undefined>(1);
  const reloadContentHeight = useCallback(() => {
    if (scrollViewHeight.current * headerViewHeight.current <= 0) {
      return;
    }
    const height = scrollViewHeight.current - headerViewHeight.current;
    setContentHeight(height);
  }, [setContentHeight]);
  const pageManagerProps = useMemo(
    () => ({
      data,
      initialScrollIndex,
      onSelectedPageIndex: (index: number) => {
        if (index >= stickyConfig.data.length) {
          return;
        }
        onSelectedPageIndex?.(index);
        stickyConfig.data.forEach((_item, _index) => {
          _item.refreshingFocusedRef.current?.setFocused(_index === index);
        });
        stickyConfig.data[index].freezeRef.current?.setFreeze(false);
        stickyConfig.lastIndex = index;
      },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [stickyConfig, data, initialScrollIndex, onSelectedPageIndex],
  );
  const pageManager = useMemo(
    () => new PageManager(pageManagerProps),
    [pageManagerProps],
  );
  const renderContentItem = useCallback(
    ({
      item,
      index,
    }: {
      item: {
        page: ITabPageType;
      };
      index: number;
    }) => (
      <Animated.View
        style={{
          width: contentItemWidth,
          height: '100%',
        }}
      >
        <RefreshingFocusedContainer
          initialFocused={index === initialScrollIndex}
          ref={stickyConfig.data[index].refreshingFocusedRef}
          setScrollHeaderIsRefreshing={() => {}}
        >
          <FreezeContainer
            initialFreeze={index !== initialScrollIndex}
            ref={stickyConfig.data[index].freezeRef}
          >
            <item.page />
          </FreezeContainer>
        </RefreshingFocusedContainer>
      </Animated.View>
    ),
    [stickyConfig.data, contentItemWidth, initialScrollIndex],
  );
  const Content = pageManager.renderContentView;
  return (
    <TabScrollViewRefProvider value={scrollViewRef}>
      <ScrollView
        ref={scrollViewRef}
        onLayout={(event) => {
          scrollViewHeight.current = event.nativeEvent.layout.height;
          reloadContentHeight();
        }}
        scrollEventThrottle={16}
        stickyHeaderIndices={[1]}
        {...props}
      >
        <>{ListHeaderComponent}</>
        <Header
          ref={pageManager.headerView}
          {...pageManagerProps}
          {...headerProps}
          onLayout={(event) => {
            headerViewHeight.current = event.nativeEvent.layout.height;
            reloadContentHeight();
          }}
          shouldSelectedPageIndex={shouldSelectedPageIndex}
          onSelectedPageIndex={(pageIndex: number) => {
            pageManager?.contentView?.current?.scrollPageIndex(pageIndex);
          }}
        />
        <Stack
          ref={pageContainerRef}
          w={contentWidth}
          h={contentHeight}
          {...tabContentContainerStyle}
        >
          <Content
            windowSize={5}
            scrollEnabled={platformEnv.isNative}
            shouldSelectedPageAnimation={platformEnv.isNative}
            renderItem={renderContentItem}
          />
        </Stack>
      </ScrollView>
    </TabScrollViewRefProvider>
  );
};
