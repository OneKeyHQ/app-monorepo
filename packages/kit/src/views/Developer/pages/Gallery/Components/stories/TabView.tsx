import { useMemo } from 'react';

import {
  IconButton,
  ListView,
  SizableText,
  Stack,
  Tab,
  Toast,
} from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { Layout } from './utils/Layout';

const FirstRoute = () => (
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
  />
);

const SecondRoute = () => (
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
      style={{ height: 400 }}
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
        page: FourthRoute,
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
          Toast.error({ title: '未登录' });
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
      '吸顶用 Tab',
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
      {
        title: 'Custom tabview for swap',
        element: (
          <Stack>
            <Tab.Header
              style={{
                height: '$8',
                borderBottomWidth: 0,
              }}
              data={[
                { title: 'Swap' },
                { title: 'Bridge' },
                { title: 'Limit' },
              ]}
              itemContainerStyle={{
                px: '$2.5',
                mr: '$3',
                cursor: 'default',
              }}
              itemTitleNormalStyle={{
                color: '$textSubdued',
                fontWeight: '600',
              }}
              itemTitleSelectedStyle={{ color: '$text' }}
              cursorStyle={{
                height: '100%',
                bg: '$bgStrong',
                borderRadius: '$3',
                borderCurve: 'continuous',
              }}
              onSelectedPageIndex={(index: number) => {
                console.log('选中', index);
              }}
            />
            <IconButton
              variant="tertiary"
              icon="InfoCircleOutline"
              position="absolute"
              right="$0"
              top="$1"
            />
          </Stack>
        ),
      },
    ]}
  />
);

export default TabViewGallery;
