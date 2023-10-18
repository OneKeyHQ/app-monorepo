import {
  memo,
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { useIntl } from 'react-intl';
import { ScrollView } from 'react-native';

import { Stack, TabView, Text } from '@onekeyhq/components';
import type { ForwardRefHandle } from '@onekeyhq/components/src/CollapsibleTabView/NativeNestedTabView/NestedTabView';
import { SceneMap } from '@onekeyhq/components/src/TabView/SceneMap';
import type { Route } from '@onekeyhq/components/src/TabView/types';

import HeaderView from './HeaderView';

const FirstRoute = () => (
  <ScrollView>
    <Stack bg="#ff4081" flex={1}>
      <Text>demo1</Text>
    </Stack>
  </ScrollView>
);
const SecondRoute = () => (
  <ScrollView>
    <Stack bg="#673ab7" flex={1}>
      {Array.from({ length: 100 }).map((_, index) => (
        <Text key={index}>demo2 ${index}</Text>
      ))}
    </Stack>
  </ScrollView>
);

const OtherRoute = () => (
  <ScrollView>
    <Stack bg="#ff4081" flex={1}>
      <Text>demo3</Text>
    </Stack>
  </ScrollView>
);

const renderScene = SceneMap({
  first: FirstRoute,
  second: SecondRoute,
  other: OtherRoute,
});

function HomePage() {
  const tabsViewRef = useRef<ForwardRefHandle>(null);
  const [showDemo3, setShowDemo3] = useState(false);
  const intl = useIntl();
  const onRefresh = useCallback(() => {
    tabsViewRef?.current?.setRefreshing(true);
  }, []);

  const onIndexChange = useCallback((index: number) => {}, []);

  const onDemo3VisibleChange = useCallback(() => {
    setShowDemo3((pre) => !pre);
  }, []);

  const [routes, setRoutes] = useState<Route[]>([
    { key: 'first', title: intl.formatMessage({ id: 'form__tools' }) },
    { key: 'second', title: intl.formatMessage({ id: 'form__tools' }) },
    { key: 'other', title: intl.formatMessage({ id: 'form__tools' }) },
  ]);

  useLayoutEffect(() => {
    if (showDemo3) {
      setRoutes((pre) => [
        ...pre,
        { key: 'other', title: intl.formatMessage({ id: 'form__tools' }) },
      ]);
    } else {
      setRoutes((pre) => pre.slice(0, 2));
    }
  }, [intl, showDemo3]);

  const renderHeaderView = useCallback(() => {
    console.log('=====>>>> renderHeaderView');
    return <HeaderView switchDemoVisible={onDemo3VisibleChange} />;
  }, [onDemo3VisibleChange]);

  return useMemo(
    () => (
      <TabView
        lazy
        navigationState={{ routes }}
        onRefresh={onRefresh}
        onIndexChange={onIndexChange}
        renderScene={renderScene}
        renderHeaderView={renderHeaderView}
        ref={tabsViewRef}
      />
    ),
    [routes, onRefresh, onIndexChange, renderHeaderView],
  );
}

export default memo(HomePage);
