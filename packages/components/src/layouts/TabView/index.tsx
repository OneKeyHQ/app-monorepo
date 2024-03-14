import {
  createRef,
  forwardRef,
  useCallback,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { ComponentType, ReactElement } from 'react';

import {
  PageContentView,
  PageManager,
} from '@onekeyfe/react-native-tab-page-view';
import { Animated } from 'react-native';
import { withStaticProperties } from 'tamagui';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { Stack } from '../../primitives';
import { RefreshControl } from '../RefreshControl';
import { ScrollView } from '../ScrollView';

import { FreezeContainer } from './FreezeContainer';
import { Header } from './Header';
import { Page } from './Page';
import {
  RefreshingFocusedContainer,
  useTabIsRefreshingFocused,
} from './RefreshingFocused';

import type { IFreezeContainerRef } from './FreezeContainer';
import type { IHeaderProps } from './Header';
import type { IRefreshingFocusedContainerRef } from './RefreshingFocused';
import type { IScrollViewProps, IScrollViewRef } from '../ScrollView';
import type { LayoutChangeEvent } from 'react-native';

export type ITabPageProps = {
  onContentSizeChange: (width: number, height: number) => void;
};

export type ITabPageType = ComponentType<ITabPageProps>;

export interface ITabProps extends IScrollViewProps {
  data: { title: string; page: ITabPageType }[];
  initialScrollIndex?: number;
  ListHeaderComponent?: ReactElement;
  headerProps?: Omit<IHeaderProps, 'data'>;
  contentItemWidth?: Animated.Value;
  contentWidth?: number;
  onSelectedPageIndex?: (pageIndex: number) => void;
  shouldSelectedPageIndex?: (pageIndex: number) => boolean;
}

const TabComponent = (
  {
    data,
    initialScrollIndex = 0,
    ListHeaderComponent,
    headerProps,
    contentItemWidth,
    contentWidth,
    onSelectedPageIndex,
    shouldSelectedPageIndex,
    ...props
  }: ITabProps,
  // fix missing forwardRef warnings.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _: any,
) => {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [contentHeight, setContentHeight] = useState<number | undefined>(1);
  const scrollViewRef = useRef<IScrollViewRef | null>(null);
  const pageContainerRef = useRef<any | null>(null);
  const dataCount = useMemo(() => data.length, [data]);
  const stickyConfig = useMemo(
    () => ({
      lastIndex: initialScrollIndex,
      scrollViewHeight: 0,
      headerViewY: 0,
      headerViewHeight: 0,
      data: new Array(dataCount).fill({}).map(() => ({
        contentHeight: 0,
        contentOffsetY: 0,
        freezeRef: createRef<IFreezeContainerRef>(),
        refreshingFocusedRef: createRef<IRefreshingFocusedContainerRef>(),
      })),
    }),
    [dataCount, initialScrollIndex],
  );
  const reloadContentHeight = useCallback(
    (index: number) => {
      if (stickyConfig.scrollViewHeight * stickyConfig.headerViewHeight <= 0) {
        return;
      }
      const minHeight =
        stickyConfig.scrollViewHeight - stickyConfig.headerViewHeight;
      const height = Math.max(
        stickyConfig.data[index].contentHeight,
        minHeight,
      );
      if (platformEnv.isNative) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        pageContainerRef?.current?.setNativeProps?.({
          height,
        });
      } else {
        if (stickyConfig.data[index].contentHeight <= 0) {
          return;
        }
        setContentHeight(height);
      }
    },
    [stickyConfig, pageContainerRef],
  );
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
        reloadContentHeight(index);
        const { contentOffsetY } = stickyConfig.data[index];
        const lastContentOffsetY =
          stickyConfig.data?.[stickyConfig.lastIndex]?.contentOffsetY ?? 0;
        if (
          Math.round(lastContentOffsetY) < Math.round(stickyConfig.headerViewY)
        ) {
          stickyConfig.data[index].contentOffsetY = lastContentOffsetY;
        } else if (
          Math.round(contentOffsetY) <= Math.round(stickyConfig.headerViewY)
        ) {
          stickyConfig.data[index].contentOffsetY = stickyConfig.headerViewY;
        }
        // Need to wait for contentHeight to be updated on android and web
        setTimeout(() => {
          if (platformEnv.isNative) {
            scrollViewRef?.current?.setNativeProps({
              contentOffset: { y: stickyConfig.data[index].contentOffsetY },
            });
          } else {
            scrollViewRef?.current?.scrollTo({
              y: stickyConfig.data[index].contentOffsetY,
              animated: false,
            });
          }
        });
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
          setScrollHeaderIsRefreshing={setIsRefreshing}
        >
          <FreezeContainer
            initialFreeze={index !== initialScrollIndex}
            ref={stickyConfig.data[index].freezeRef}
          >
            <item.page
              onContentSizeChange={(_width: number, height: number) => {
                stickyConfig.data[index].contentHeight = height;
                if (index === pageManager.pageIndex) {
                  reloadContentHeight(index);
                }
              }}
            />
          </FreezeContainer>
        </RefreshingFocusedContainer>
      </Animated.View>
    ),
    [
      stickyConfig.data,
      contentItemWidth,
      initialScrollIndex,
      reloadContentHeight,
      pageManager.pageIndex,
    ],
  );
  const Content = pageManager.renderContentView;
  const onRefresh = useCallback(() => {
    stickyConfig.data[
      pageManager.pageIndex
    ].refreshingFocusedRef.current?.setIsRefreshing(true, true);
  }, [pageManager.pageIndex, stickyConfig.data]);
  return (
    <ScrollView
      ref={scrollViewRef}
      onLayout={(event) => {
        stickyConfig.scrollViewHeight = event.nativeEvent.layout.height;
        reloadContentHeight(pageManager.pageIndex);
      }}
      scrollEventThrottle={16}
      onScroll={(event) => {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        stickyConfig.data[pageManager.pageIndex].contentOffsetY = (
          event as any
        ).nativeEvent.contentOffset.y;
      }}
      stickyHeaderIndices={[1]}
      nestedScrollEnabled
      refreshControl={
        platformEnv.isNative ? (
          <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />
        ) : undefined
      }
      {...props}
    >
      <>{ListHeaderComponent}</>
      <Header
        ref={pageManager.headerView}
        {...pageManagerProps}
        {...headerProps}
        shouldSelectedPageIndex={shouldSelectedPageIndex}
        onLayout={(event) => {
          stickyConfig.headerViewHeight = event.nativeEvent.layout.height;
        }}
        onSelectedPageIndex={(pageIndex: number) => {
          pageManager?.contentView?.current?.scrollPageIndex(pageIndex);
        }}
      />
      <Stack
        ref={pageContainerRef}
        onLayout={(event: LayoutChangeEvent) => {
          stickyConfig.headerViewY =
            event.nativeEvent.layout.y - stickyConfig.headerViewHeight;
        }}
        w={contentWidth}
        h={contentHeight}
        minHeight={
          stickyConfig.scrollViewHeight - stickyConfig.headerViewHeight
        }
      >
        <Content
          windowSize={5}
          scrollEnabled={platformEnv.isNative}
          shouldSelectedPageAnimation={platformEnv.isNative}
          renderItem={renderContentItem}
        />
      </Stack>
    </ScrollView>
  );
};

export const Tab = withStaticProperties(forwardRef(TabComponent), {
  Header,
  Page,
  Manager: PageManager,
  Content: PageContentView,
});

export { useTabIsRefreshingFocused };
