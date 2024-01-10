import { useMemo } from 'react';

import { ListView, SizableText, Stack, Tab } from '@onekeyhq/components';
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
        title: '标签1',
        page: FirstRoute,
      },
      {
        title: '标签2',
        page: SecondRoute,
      },
    ],
    [],
  );
  return (
    <Tab
      data={data}
      initialScrollIndex={1}
      stickyHeaderIndices={[1]}
      ListHeaderComponent={<Stack h={100} />}
      // style={{ width: 400, height: 600, backgroundColor: 'black' }}
      h={600}
      nestedScrollEnabled
      headerProps={{
        itemContainerStyle: { flex: 1 },
        cursorStyle: { width: '70%', h: '$0.5', bg: '$text' },
      }}
    />
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
        title: 'Header 自定义1',
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
              height: 44,
              borderRadius: 44 / 2.0,
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
        title: 'Manager 组合悬浮使用',
        element: <TabViewScrollStickyDemo />,
      },
    ]}
  />
);

export default TabViewGallery;
