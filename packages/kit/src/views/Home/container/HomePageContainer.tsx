import { memo, useCallback, useMemo, useRef, useState } from 'react';

import { useIntl } from 'react-intl';
import { RefreshControl, useWindowDimensions } from 'react-native';

import type { IScrollViewRef } from '@onekeyhq/components';
import { Page, ScrollView, Stack, Text } from '@onekeyhq/components';
import { getTokens } from '@onekeyhq/components/src/hooks';
import { useThemeValue } from '@onekeyhq/components/src/Provider/hooks/useThemeValue';
import { PageManager } from '@onekeyhq/components/src/TabView';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { NFTListContainer } from './NFTListContainer';
import { TokenListContainer } from './TokenListContainer';
import { TxHistoryListContainer } from './TxHistoryContainer';
import { WalletOverviewContainer } from './WalletOverviewContainer';

const OtherRoute = ({
  onContentSizeChange,
}: {
  onContentSizeChange: ((w: number, h: number) => void) | undefined;
}) => (
  <ScrollView
    style={{ flex: 1 }}
    scrollEnabled={false}
    onContentSizeChange={onContentSizeChange}
  >
    <Stack bg="#ff4081" height="$100">
      <Text>demo3</Text>
    </Stack>
  </ScrollView>
);

function HomePageContainer() {
  const screenWidth = useWindowDimensions().width;
  const sideBarWidth = getTokens().size.sideBarWidth.val;
  const intl = useIntl();

  const onRefresh = useCallback(() => {
    // tabsViewRef?.current?.setRefreshing(true);
  }, []);

  const [contentHeight, setContentHeight] = useState<number | undefined>(1);
  const scrollView = useRef<IScrollViewRef | null>(null);
  const container = useRef<any | null>(null);
  const config = useMemo(
    () => ({
      lastIndex: -1,
      scrollViewHeight: 0,
      headerLayoutY: 0,
      headerViewHeight: 0,
    }),
    [],
  );

  const [bgAppColor, textColor, textSubduedColor] = useThemeValue(
    ['bgApp', 'text', 'textSubdued'],
    undefined,
    true,
  );
  const data = useMemo(
    () => [
      {
        title: intl.formatMessage({
          id: 'asset__tokens',
        }),
        contentHeight: undefined,
        contentOffsetY: 0,
        page: memo(TokenListContainer, () => true),
      },
      {
        title: intl.formatMessage({
          id: 'asset__collectibles',
        }),
        contentHeight: undefined,
        contentOffsetY: 0,
        page: memo(NFTListContainer, () => true),
      },
      {
        title: intl.formatMessage({
          id: 'transaction__history',
        }),
        contentHeight: undefined,
        contentOffsetY: 0,
        page: memo(TxHistoryListContainer, () => true),
      },
      {
        title: intl.formatMessage({
          id: 'form__tools',
        }),
        contentHeight: undefined,
        contentOffsetY: 0,
        page: memo(OtherRoute, () => true),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [intl, bgAppColor, textColor, textSubduedColor],
  );

  const reloadContentHeight = useCallback(
    (index: number) => {
      const finallyHeight = config.scrollViewHeight - config.headerViewHeight;
      if (platformEnv.isNative) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        container?.current?.setNativeProps?.({
          height: Math.max(data[index].contentHeight ?? 0, finallyHeight),
        });
      } else {
        setContentHeight(
          Math.max(data[index].contentHeight ?? 0, finallyHeight),
        );
      }
    },
    [data, config, container],
  );

  const pageManager = useMemo(
    () =>
      new PageManager({
        data,
        initialScrollIndex: 0,
        onSelectedPageIndex: (index: number) => {
          reloadContentHeight(index);
          const { contentOffsetY } = data[index];
          const lastContentOffsetY =
            data?.[config.lastIndex]?.contentOffsetY ?? 0;

          if (
            Math.round(lastContentOffsetY) < Math.round(config.headerLayoutY)
          ) {
            data[index].contentOffsetY = lastContentOffsetY;
          } else if (
            Math.round(contentOffsetY) <= Math.round(config.headerLayoutY)
          ) {
            data[index].contentOffsetY = config.headerLayoutY;
          }

          // Need to wait for contentHeight to be updated
          setTimeout(() => {
            if (platformEnv.isNative) {
              scrollView?.current?.setNativeProps({
                contentOffset: { y: data[index].contentOffsetY },
              });
            } else {
              scrollView?.current?.scrollTo({
                y: data[index].contentOffsetY,
                animated: false,
              });
            }
          });
          config.lastIndex = index;
        },
      }),
    [data, config, scrollView, reloadContentHeight],
  );
  const Header = pageManager.renderHeaderView;
  const Content = pageManager.renderContentView;

  const renderHeaderView = useCallback(() => <WalletOverviewContainer />, []);

  const renderContentItem = useCallback(
    ({
      item,
      index,
    }: {
      item: {
        backgroundColor: string;
        contentHeight: number | undefined;
        page: any;
      };
      index: number;
    }) => (
      <Stack
        style={{
          flex: 1,
        }}
      >
        <item.page
          onContentSizeChange={(_: number, height: number) => {
            item.contentHeight = height;
            if (index === pageManager.pageIndex) {
              reloadContentHeight(index);
            }
          }}
        />
      </Stack>
    ),
    [pageManager, reloadContentHeight],
  );

  return useMemo(
    () => (
      <Page>
        <Page.Body alignItems="center">
          <ScrollView
            $md={{
              width: '100%',
            }}
            $gtMd={{
              width: screenWidth - sideBarWidth - 150,
              maxWidth: 1024,
            }}
            refreshControl={
              <RefreshControl refreshing={false} onRefresh={onRefresh} />
            }
            stickyHeaderIndices={[1]}
            ref={scrollView}
            showsVerticalScrollIndicator={false}
            scrollEventThrottle={16}
            onLayout={(event) => {
              config.scrollViewHeight = event.nativeEvent.layout.height;
            }}
            onScroll={(event) => {
              // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
              data[pageManager.pageIndex].contentOffsetY = (
                event as any
              ).nativeEvent.contentOffset.y;
            }}
          >
            {renderHeaderView()}
            <Header
              // HTPageHeaderView.defaultProps in TabView
              style={{
                height: 54,
                backgroundColor: bgAppColor,
              }}
              onLayout={(event: any) => {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                config.headerViewHeight = event.nativeEvent.layout.height;
              }}
              itemTitleStyle={{ fontSize: 16, textTransform: 'uppercase' }}
              itemTitleNormalStyle={{ color: textSubduedColor }}
              itemTitleSelectedStyle={{ color: textColor, fontSize: 16 }}
              cursorStyle={{
                left: 12,
                right: 12,
                height: 2,
                backgroundColor: textColor,
              }}
            />
            <Stack
              ref={container}
              onLayout={(event) => {
                config.headerLayoutY =
                  event.nativeEvent.layout.y - config.headerViewHeight;
              }}
              style={{ height: contentHeight }}
            >
              <Content
                windowSize={5}
                scrollEnabled={platformEnv.isNative}
                shouldSelectedPageAnimation={platformEnv.isNative}
                renderItem={renderContentItem}
              />
            </Stack>
          </ScrollView>
        </Page.Body>
      </Page>
    ),
    [
      screenWidth,
      sideBarWidth,
      bgAppColor,
      textColor,
      textSubduedColor,
      contentHeight,
      Header,
      Content,
      onRefresh,
      renderHeaderView,
      renderContentItem,
      data,
      config,
      pageManager,
    ],
  );
}

export { HomePageContainer };
