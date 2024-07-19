import {
  createContext,
  createRef,
  forwardRef,
  memo,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { ComponentType, ReactElement, RefObject } from 'react';

import {
  PageContentView,
  PageManager,
  SelectedLabel,
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
  showWalletActions?: boolean;
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
  const createStickyDataConfig = useCallback(
    (valueList: ITabProps['data']) =>
      new Array(valueList?.length ?? 0).fill({}).map(() => ({
        contentHeight: 0,
        contentOffsetY: 0,
        freezeRef: createRef<IFreezeContainerRef>(),
        refreshingFocusedRef: createRef<IRefreshingFocusedContainerRef>(),
      })),
    [],
  );
  const stickyConfig = useMemo(
    () => ({
      lastIndex: initialScrollIndex,
      scrollViewHeight: 0,
      headerViewY: 0,
      headerViewHeight: 0,
      data: createStickyDataConfig(data),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [createStickyDataConfig],
  );
  useEffect(() => {
    stickyConfig.lastIndex = initialScrollIndex;
    stickyConfig.data = createStickyDataConfig(data);
  }, [data, initialScrollIndex, createStickyDataConfig, stickyConfig]);
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
                if (index === stickyConfig.lastIndex) {
                  reloadContentHeight(index);
                }
              }}
            />
          </FreezeContainer>
        </RefreshingFocusedContainer>
      </Animated.View>
    ),
    [
      stickyConfig.lastIndex,
      stickyConfig.data,
      contentItemWidth,
      initialScrollIndex,
      reloadContentHeight,
    ],
  );
  const Content = pageManager.renderContentView;
  const onRefresh = useCallback(() => {
    stickyConfig.data[
      pageManager.pageIndex
    ].refreshingFocusedRef.current?.setIsRefreshing(true, true);
  }, [pageManager.pageIndex, stickyConfig.data]);
  return (
    <TabScrollViewRefProvider value={scrollViewRef}>
      <ScrollView
        key={data.map((item) => item.title).join('')}
        ref={scrollViewRef}
        onLayout={(event) => {
          stickyConfig.scrollViewHeight = event.nativeEvent.layout.height;
          reloadContentHeight(pageManager.pageIndex);
        }}
        scrollEventThrottle={16}
        onScroll={(event) => {
          // This variable might be null when swiping to dismiss on iOS,
          //  so it needs to be checked.
          if (stickyConfig.data[pageManager.pageIndex]) {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            stickyConfig.data[pageManager.pageIndex].contentOffsetY = (
              event as any
            ).nativeEvent.contentOffset.y;
          }
        }}
        stickyHeaderIndices={[1]}
        nestedScrollEnabled
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />
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

export const Tab = withStaticProperties(forwardRef(TabComponent), {
  Header,
  Page,
  Manager: PageManager,
  Content: PageContentView,
  SelectedLabel,
});

export { useTabIsRefreshingFocused };
