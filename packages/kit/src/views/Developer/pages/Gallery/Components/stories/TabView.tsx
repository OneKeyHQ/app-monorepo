import { useMemo } from 'react';

import { ListView, SizableText, Stack, Tab, Toast } from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { Layout } from './utils/Layout';

const FirstRoute = ({
  onContentSizeChange,
}: {
  onContentSizeChange: ((w: number, h: number) => void) | undefined;
}) => (
  <ListView
    data={new Array(20).fill({})}
    estimatedItemSize="$10"
    scrollEnabled={platformEnv.isWebTouchable}
    disableScrollViewPanResponder
    renderItem={({ index }) => (
      <Stack style={{ padding: 10 }}>
        <SizableText>Page 1 Row: {index}</SizableText>
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
  <ListView
    data={new Array(50).fill({})}
    estimatedItemSize="$10"
    scrollEnabled={platformEnv.isWebTouchable}
    disableScrollViewPanResponder
    renderItem={({ index }) => (
      <Stack style={{ padding: 20 }}>
        <SizableText>Page 2 Row: {index}</SizableText>
      </Stack>
    )}
    onContentSizeChange={onContentSizeChange}
  />
);

const TabViewScrollStickyDemo = () => {
  const data = useMemo(
    () => [
      {
        title: '吸顶标签1',
        page: FirstRoute,
      },
      {
        title: '吸顶标签2',
        page: SecondRoute,
      },
    ],
    [],
  );
  return (
    <Tab
      data={data}
      initialScrollIndex={1}
      ListHeaderComponent={<Stack bg="$bgInfoStrong" h={100} />}
      // style={{ width: 400, height: 600, backgroundColor: 'black' }}
      h={600}
      headerProps={{
        itemContainerStyle: { flex: 1 },
        cursorStyle: { width: '70%', h: '$0.5', bg: '$text' },
      }}
      onSelectedPageIndex={(index: number) => {
        console.log('选中', index);
      }}
    />
  );
};

const ThirdRoute = () => (
  <ListView
    data={new Array(20).fill({})}
    estimatedItemSize="$10"
    renderItem={({ index }) => (
      <Stack style={{ padding: 10 }}>
        <SizableText>Page 1 Row: {index}</SizableText>
      </Stack>
    )}
  />
);

const FourthRoute = () => (
  <ListView
    data={new Array(50).fill({})}
    estimatedItemSize="$10"
    renderItem={({ index }) => (
      <Stack style={{ padding: 20 }}>
        <SizableText>Page 2 Row: {index}</SizableText>
      </Stack>
    )}
  />
);

const TabViewScrollPageDemo = () => {
  const data = useMemo(
    () => [
      {
        title: '不吸顶标签1',
        page: ThirdRoute,
      },
      {
        title: '禁止选中标签2',
        page: SecondRoute,
      },
      {
        title: '不吸顶标签3',
        page: FourthRoute,
      },
    ],
    [],
  );
  return (
    <Tab.Page
      data={data}
      initialScrollIndex={2}
      ListHeaderComponent={<Stack bg="$bgInfoStrong" h={100} />}
      ListFooterComponent={<Stack bg="$bgInfoStrong" h={100} />}
      headerProps={{
        cursorStyle: { width: '70%', h: '$0.5', bg: '$text' },
      }}
      shouldSelectedPageIndex={(pageIndex) => {
        const result = pageIndex !== 1;
        if (!result) {
          Toast.error({ message: '未登录' });
        }
        return result;
      }}
      onSelectedPageIndex={(index: number) => {
        console.log('选中', index);
      }}
    />
  );
};

const TabViewGallery = () => (
  <Layout
    description=""
    suggestions={[
      '吸顶用 Tab, 它继承自 ScrollView, 请记得 onContentSizeChange, 关掉 data 里面每个 page 的 scrollEnabled 和 disableScrollViewPanResponder',
      '不需要吸顶用 Tab.Page, 它继承自 Fragment, 尽量不要把 Tab.Page 放到 ScrollView 里面',
    ]}
    boundaryConditions={[]}
    elements={[
      {
        title: 'Header 自定义1',
        element: (
          <Tab.Header
            data={[
              { title: '标签1' },
              { title: '标签2' },
              { title: '标签标签3' },
              { title: '标签4' },
            ]}
            onSelectedPageIndex={(index: number) => {
              console.log('选中', index);
            }}
          />
        ),
      },
      {
        title: 'Header 自定义2',
        element: (
          <Tab.Header
            data={[
              { title: '标签1' },
              { title: '标签2' },
              { title: '标签标签3' },
              { title: '标签4' },
            ]}
            itemContainerStyle={{ flex: 1 }}
            itemTitleNormalStyle={{ color: '$text', fontSize: 13 }}
            itemTitleSelectedStyle={{ color: '$textInverse', fontSize: 15 }}
            cursorStyle={{
              width: 88,
              height: 34,
              borderRadius: 34 / 2.0,
              top: 5,
              bg: '$bgInfoStrong',
            }}
            onSelectedPageIndex={(index: number) => {
              console.log('选中', index);
            }}
          />
        ),
      },
      {
        title: 'Tab 需要吸顶使用',
        element: <TabViewScrollStickyDemo />,
      },
      {
        title: 'Tab.Page 不需要吸顶使用',
        element: (
          <Stack h={700}>
            <TabViewScrollPageDemo />
          </Stack>
        ),
      },
    ]}
  />
);

export default TabViewGallery;
