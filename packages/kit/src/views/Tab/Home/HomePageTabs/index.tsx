import {
  Component,
  Fragment,
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { useIntl } from 'react-intl';
import { FlatList, RefreshControl, ScrollView } from 'react-native';
import { useDispatch } from 'react-redux';

import { Screen, Stack, Text } from '@onekeyhq/components';
import { PageManager } from '@onekeyhq/components/src/TabView';

import { useAppSelector } from '../../../../hooks/useAppSelector';
import { setHomeTabViewActive } from '../../../../store/reducers/status';

import HeaderView from './HeaderView';
import { HomePageTabsEnum } from './types';

const FirstRoute = ({ onContentSizeChange }: { onContentSizeChange: ((w: number, h: number) => void) | undefined}) => (
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
const SecondRoute = ({ onContentSizeChange }: { onContentSizeChange: ((w: number, h: number) => void) | undefined}) => (
  <ScrollView
    style={{ flex: 1 }}
    scrollEnabled={false}
    onContentSizeChange={onContentSizeChange}
  >
    <Stack bg="#673ab7">
      {Array.from({ length: 100 }).map((_, index) => (
        <Text key={index}>demo2 ${index}</Text>
      ))}
    </Stack>
  </ScrollView>
);

const OtherRoute = ({ onContentSizeChange }: { onContentSizeChange: ((w: number, h: number) => void) | undefined}) => (
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

const ListRoute = ({ onContentSizeChange }: { onContentSizeChange: ((w: number, h: number) => void) | undefined}) => (
  <FlatList
    data={new Array(50).fill({})}
    scrollEnabled={false}
    renderItem={({ item, index }) => (
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

  const [contentHeight, setContentHeight] = useState<number | undefined>(0);
  const data = useMemo(
    () => [
      {
        title: '你好',
        backgroundColor: 'skyblue',
        contentHeight: undefined,
        page: FirstRoute,
      },
      {
        title: '世界',
        backgroundColor: 'coral',
        contentHeight: undefined,
        page: SecondRoute,
      },
      {
        title: '晒太阳喝热水',
        backgroundColor: 'turquoise',
        contentHeight: undefined,
        page: ListRoute,
      },
      {
        title: '骑单车',
        backgroundColor: 'pink',
        contentHeight: undefined,
        page: OtherRoute,
      },
    ],
    [],
  );
  const pageManager = useMemo(
    () =>
      new PageManager({
        data,
        initialScrollIndex: 2,
        onSelectedPageIndex: (index: number) => {
          setContentHeight(data[index].contentHeight);
        },
      }),
    [],
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
              height: 50,
              backgroundColor: 'white',
              borderBottomColor: '#F5F5F5',
              borderBottomWidth: 1,
            }}
          />
          <Stack style={{ height: contentHeight }}>
            <Content
              renderItem={({ item, index }: { item: { backgroundColor: string, contentHeight: number | undefined, page: any }; index: number }) => (
                <Stack
                  style={{
                    flex: 1,
                    backgroundColor: item.backgroundColor,
                  }}
                >
                  <item.page
                    onContentSizeChange={(width: number, height: number) => {
                      item.contentHeight = height;
                    }}
                  />
                </Stack>
              )}
            />
          </Stack>
        </ScrollView>
      </Stack>
    ),
    [contentHeight],
  );
}

export default HomePage;
