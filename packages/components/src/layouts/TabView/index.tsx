import { forwardRef, useCallback, useMemo, useRef, useState } from 'react';
import type { ReactElement } from 'react';

import { PageContentView, PageManager } from 'react-native-tab-page-view';
import { withStaticProperties } from 'tamagui';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { Stack } from '../../primitives';
import { ScrollView } from '../ScrollView';

import { Header } from './Header';

import type { IHeaderProps } from './Header';
import type { IScrollViewProps, IScrollViewRef } from '../ScrollView';
import type { LayoutChangeEvent } from 'react-native';

type IPageType = ({
  onContentSizeChange,
}: {
  onContentSizeChange: (width: number, height: number) => void;
}) => ReactElement | null;

export interface ITabProps extends IScrollViewProps {
  data: { title: string; page: IPageType }[];
  initialScrollIndex?: number;
  ListHeaderComponent?: ReactElement;
  headerProps?: Omit<IHeaderProps, 'data'>;
}

const TabComponent = ({
  data,
  initialScrollIndex,
  ListHeaderComponent,
  headerProps,
  ...props
}: ITabProps) => {
  const [contentHeight, setContentHeight] = useState<number | undefined>(1);
  const scrollViewRef = useRef<IScrollViewRef | null>(null);
  const pageContainerRef = useRef<any | null>(null);
  const dataCount = useMemo(() => data.length, [data]);
  const stickyConfig = useMemo(
    () => ({
      lastIndex: -1,
      scrollViewHeight: 0,
      headerViewY: 0,
      headerViewHeight: 0,
      data: new Array(dataCount).fill({}).map(() => ({
        contentHeight: 0,
        contentOffsetY: 0,
      })),
    }),
    [dataCount],
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
    [stickyConfig, data, initialScrollIndex],
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
        page: IPageType;
      };
      index: number;
    }) => (
      <item.page
        onContentSizeChange={(_: number, height: number) => {
          stickyConfig.data[index].contentHeight = height;
          if (index === pageManager.pageIndex) {
            reloadContentHeight(index);
          }
        }}
      />
    ),
    [stickyConfig.data, pageManager, reloadContentHeight],
  );
  const Content = pageManager.renderContentView;
  return (
    <ScrollView
      ref={scrollViewRef}
      onLayout={(event) => {
        stickyConfig.scrollViewHeight = event.nativeEvent.layout.height;
      }}
      scrollEventThrottle={16}
      onScroll={(event) => {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        stickyConfig.data[pageManager.pageIndex].contentOffsetY = (
          event as any
        ).nativeEvent.contentOffset.y;
      }}
      {...props}
    >
      {ListHeaderComponent}
      <Header
        ref={pageManager.headerView}
        {...pageManagerProps}
        {...headerProps}
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
  );
};

export const Tab = withStaticProperties(forwardRef(TabComponent), {
  Header,
  Manager: PageManager,
  Content: PageContentView,
});
