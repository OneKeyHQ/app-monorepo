/* eslint-disable react-hooks/rules-of-hooks */
/* eslint-disable react/no-unstable-nested-components */
import { useMemo } from 'react';

import { ListView, SizableText, Stack } from '@onekeyhq/components';
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
  return null;
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
  return null;
};

const TabViewGallery = () => (
  <Layout
    filePath={globalThis.__CURRENT_FILE_PATH__}
    componentName="TabView"
    suggestions={[
      '吸顶用 Tab',
      '不需要吸顶用 Tab.Page, 它继承自 Fragment, 尽量不要把 Tab.Page 放到 ScrollView 里面',
    ]}
    elements={[
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
