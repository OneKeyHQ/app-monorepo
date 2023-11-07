import { useMemo, useState } from 'react';

import { FlatList, RefreshControl } from 'react-native';
import { ScrollView } from 'tamagui';

import { Stack, Text } from '@onekeyhq/components';
import { PageHeaderView, PageManager } from '@onekeyhq/components/src/TabView';

import { Layout } from './utils/Layout';

const HeaderPropsList = {
  data: [
    { title: '标签1' },
    { title: '标签2' },
    { title: '标签标签3' },
    { title: '标签4' },
  ],
  style: {
    height: 50,
    backgroundColor: 'white',
    borderBottomColor: '#F5F5F5',
    borderBottomWidth: 1,
  },
  onSelectedPageIndex: (index: number) => {
    console.log('选中', index);
  },
};

const FirstRoute = ({
  onContentSizeChange,
}: {
  onContentSizeChange: ((w: number, h: number) => void) | undefined;
}) => (
  <FlatList
    data={new Array(20).fill({})}
    scrollEnabled={false}
    renderItem={({ index }) => (
      <Stack style={{ padding: 10 }}>
        <Text>Page 1 Row: {index}</Text>
      </Stack>
    )}
    onContentSizeChange={onContentSizeChange}
  />
);

const SecondRoute = ({
  onContentSizeChange,
}: {
  onContentSizeChange: ((w: number, h: number) => void) | undefined;
}) => (
  <FlatList
    data={new Array(50).fill({})}
    scrollEnabled={false}
    renderItem={({ index }) => (
      <Stack style={{ padding: 20 }}>
        <Text>Page 2 Row: {index}</Text>
      </Stack>
    )}
    onContentSizeChange={onContentSizeChange}
  />
);

const TabViewScrollStickyDemo = () => {
  const onRefresh = () => {};
  const [contentHeight, setContentHeight] = useState<number | undefined>(1);
  const data = useMemo(
    () => [
      {
        title: '标签1',
        backgroundColor: 'skyblue',
        contentHeight: undefined,
        page: FirstRoute,
      },
      {
        title: '标签2',
        backgroundColor: 'coral',
        contentHeight: undefined,
        page: SecondRoute,
      },
    ],
    [],
  );
  const pageManager = useMemo(
    () =>
      new PageManager({
        data,
        initialScrollIndex: 1,
        onSelectedPageIndex: (index: number) => {
          setContentHeight(data[index]?.contentHeight);
        },
      }),
    [data],
  );
  const Header = pageManager.renderHeaderView;
  const Content = pageManager.renderContentView;
  return (
    <ScrollView
      style={{ height: 600, backgroundColor: 'black' }}
      nestedScrollEnabled
      refreshControl={
        <RefreshControl refreshing={false} onRefresh={onRefresh} />
      }
      stickyHeaderIndices={[1]}
    >
      <Stack style={{ height: 100 }} />
      <Header
        // HTPageHeaderView.defaultProps in TabView
        style={HeaderPropsList.style}
        itemContainerStyle={{ flex: 1 }}
      />
      <Stack style={{ height: contentHeight }}>
        <Content
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
  );
};

const TabViewGallery = () => (
  <Layout
    description=""
    suggestions={[]}
    boundaryConditions={[]}
    elements={[
      {
        title: 'Header 单独使用',
        element: <PageHeaderView {...HeaderPropsList} />,
      },
      {
        title: 'Header 自定义1',
        element: (
          <PageHeaderView
            {...HeaderPropsList}
            itemContainerStyle={{ flex: 1 }}
            cursorStyle={{
              width: 88,
              height: 48,
              borderRadius: 48 / 2.0,
              top: 0.5,
              backgroundColor: 'black',
            }}
          />
        ),
      },
      {
        title: 'Manager 组合悬浮使用',
        element: <TabViewScrollStickyDemo />,
      },
      // {
      //   title: '悬浮案例',
      //   element: (

      //   ),
      // },
    ]}
  />
);

export default TabViewGallery;
