import { memo, useCallback, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';
import { FlatList, RefreshControl, ScrollView } from 'react-native';

import { Stack, Text } from '@onekeyhq/components';
import { useThemeValue } from '@onekeyhq/components/src/Provider/hooks/useThemeValue';
import { PageManager } from '@onekeyhq/components/src/TabView';

import HeaderView from './HeaderView';

const FirstRoute = ({
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
      <Text>demo1</Text>
    </Stack>
  </ScrollView>
);
const SecondRoute = ({
  onContentSizeChange,
}: {
  onContentSizeChange: ((w: number, h: number) => void) | undefined;
}) => (
  <ScrollView
    style={{ flex: 1 }}
    scrollEnabled={false}
    onContentSizeChange={onContentSizeChange}
  >
    <Stack bg="$bg">
      {Array.from({ length: 100 }).map((_, index) => (
        <Text color="$text" key={index}>
          demo2 ${index}
        </Text>
      ))}
    </Stack>
  </ScrollView>
);

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

const ListRoute = ({
  onContentSizeChange,
}: {
  onContentSizeChange: ((w: number, h: number) => void) | undefined;
}) => (
  <FlatList
    data={new Array(50).fill({})}
    scrollEnabled={false}
    renderItem={({ index }) => (
      <Stack style={{ padding: 20 }}>
        <Text>Row: {index}</Text>
      </Stack>
    )}
    onContentSizeChange={onContentSizeChange}
  />
);

// const renderScene = SceneMap({
//   [HomePageTabsEnum.Demo1]: FirstRoute,
//   [HomePageTabsEnum.Demo2]: SecondRoute,
//   [HomePageTabsEnum.Demo3]: OtherRoute,
// });

function HomePage() {
  const intl = useIntl();

  const onRefresh = useCallback(() => {
    // tabsViewRef?.current?.setRefreshing(true);
  }, []);

  const [contentHeight, setContentHeight] = useState<number | undefined>(1);
  const [bgAppColor, textColor, textSubduedColor] = useThemeValue(
    ['bgApp', 'text', 'textSubdued'],
    undefined,
    true,
  );
  const data = useMemo(
    () => [
      {
        title: 'Label',
        backgroundColor: 'skyblue',
        contentHeight: undefined,
        page: memo(FirstRoute, () => true),
      },
      {
        title: intl.formatMessage({
          id: 'msg__verification_failure',
        }),
        backgroundColor: 'coral',
        contentHeight: undefined,
        page: memo(SecondRoute, () => true),
      },
      {
        title: 'Label',
        backgroundColor: 'turquoise',
        contentHeight: undefined,
        page: memo(ListRoute, () => true),
      },
      {
        title: 'Label',
        backgroundColor: 'pink',
        contentHeight: undefined,
        page: memo(OtherRoute, () => true),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [intl, bgAppColor, textColor, textSubduedColor],
  );
  const pageManager = useMemo(
    () =>
      new PageManager({
        data,
        initialScrollIndex: 1,
        onSelectedPageIndex: (index: number) => {
          setContentHeight(data[index].contentHeight);
        },
      }),
    [data],
  );
  const Header = pageManager.renderHeaderView;
  const Content = pageManager.renderContentView;

  const renderHeaderView = useCallback(() => <HeaderView />, []);

  return useMemo(
    () => (
      <Stack bg="$bg" flex={1}>
        <ScrollView
          style={{ flex: 1 }}
          refreshControl={
            <RefreshControl refreshing={false} onRefresh={onRefresh} />
          }
          stickyHeaderIndices={[1]}
        >
          {renderHeaderView()}
          <Header
            // HTPageHeaderView.defaultProps in TabView
            style={{
              height: 54,
              backgroundColor: bgAppColor,
            }}
            itemTitleStyle={{ fontSize: 16 }}
            itemTitleNormalStyle={{ color: textSubduedColor }}
            itemTitleSelectedStyle={{ color: textColor, fontSize: 16 }}
            cursorStyle={{
              left: 12,
              right: 12,
              height: 2,
              backgroundColor: textColor,
            }}
          />
          <Stack style={{ height: contentHeight }}>
            <Content
              windowSize={5}
              renderItem={({
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
                    backgroundColor: item.backgroundColor,
                  }}
                >
                  <item.page
                    onContentSizeChange={(width: number, height: number) => {
                      item.contentHeight = height;
                      if (index === pageManager.pageIndex) {
                        setContentHeight(height);
                      }
                    }}
                  />
                </Stack>
              )}
            />
          </Stack>
        </ScrollView>
      </Stack>
    ),
    [
      bgAppColor,
      textColor,
      textSubduedColor,
      contentHeight,
      Header,
      Content,
      onRefresh,
      renderHeaderView,
      pageManager,
    ],
  );
}

export default HomePage;
