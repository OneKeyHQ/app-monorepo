import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { useIntl } from 'react-intl';
import { ScrollView } from 'react-native';
import { useDispatch } from 'react-redux';

import { Screen, Stack, TabView, Text } from '@onekeyhq/components';
import type { ForwardRefHandle } from '@onekeyhq/components/src/TabView/NativeTabView/NestedTabView';
import { SceneMap } from '@onekeyhq/components/src/TabView/SceneMap';
import type { Route } from '@onekeyhq/components/src/TabView/types';

import { useAppSelector } from '../../../../hooks/useAppSelector';
import { setHomeTabViewActive } from '../../../../store/reducers/status';

import HeaderView from './HeaderView';
import { HomePageTabsEnum } from './types';

const FirstRoute = () => (
  <ScrollView>
    <Stack bg="#ff4081" height="$100">
      <Text>demo1</Text>
    </Stack>
  </ScrollView>
);
const SecondRoute = () => (
  <ScrollView>
    <Stack bg="#673ab7">
      {Array.from({ length: 100 }).map((_, index) => (
        <Text key={index}>demo2 ${index}</Text>
      ))}
    </Stack>
  </ScrollView>
);

const OtherRoute = () => (
  <ScrollView>
    <Stack bg="#ff4081" height="$100">
      <Text>demo3</Text>
    </Stack>
  </ScrollView>
);

const renderScene = SceneMap({
  [HomePageTabsEnum.Demo1]: FirstRoute,
  [HomePageTabsEnum.Demo2]: SecondRoute,
  [HomePageTabsEnum.Demo3]: OtherRoute,
});

function HomePage() {
  const intl = useIntl();
  const dispatch = useDispatch();
  const homeTabViewActive = useAppSelector(
    (state) => state.status.homeTabViewActive,
  );
  const tabsViewRef = useRef<ForwardRefHandle>(null);
  const [showDemo3, setShowDemo3] = useState(true);

  const globalRoutes: Route[] = useMemo(
    () => [
      {
        key: HomePageTabsEnum.Demo1,
        title: intl.formatMessage({ id: 'form__tools' }),
      },
      {
        key: HomePageTabsEnum.Demo2,
        title: intl.formatMessage({ id: 'form__tools' }),
      },
      {
        key: HomePageTabsEnum.Demo3,
        title: intl.formatMessage({ id: 'form__tools' }),
      },
    ],
    [intl],
  );

  const [routes, setRoutes] = useState<Route[]>(globalRoutes);

  const onRefresh = useCallback(() => {
    tabsViewRef?.current?.setRefreshing(true);
  }, []);

  const onIndexChange = useCallback(
    (index: number) => {
      const tabKey = routes?.[index]?.key;
      if (tabKey) {
        dispatch(
          setHomeTabViewActive({
            activeTab: tabKey as HomePageTabsEnum,
            disUpdate: true,
          }),
        );
      }
    },
    [dispatch, routes],
  );

  const onDemo3VisibleChange = useCallback(() => {
    setShowDemo3((pre) => !pre);
  }, []);

  useLayoutEffect(() => {
    if (showDemo3) {
      setRoutes(() => globalRoutes);
    } else {
      setRoutes((pre) =>
        pre.filter((item) => item.key !== HomePageTabsEnum.Demo3),
      );
    }
  }, [globalRoutes, showDemo3]);

  useEffect(() => {
    if (homeTabViewActive?.disUpdate) return;
    const saveIndex = routes.findIndex(
      (item) => item.key === homeTabViewActive?.activeTab,
    );
    if (saveIndex !== -1) {
      tabsViewRef?.current?.setPageIndex(saveIndex);
    }
  }, [homeTabViewActive, routes]);

  const renderHeaderView = useCallback(
    () => <HeaderView switchDemoVisible={onDemo3VisibleChange} />,
    [onDemo3VisibleChange],
  );

  return useMemo(
    () => (
      <Screen>
        <TabView
        navigationState={{ routes }}
        onRefresh={onRefresh}
        onIndexChange={onIndexChange}
        renderScene={renderScene}
        renderHeaderView={renderHeaderView}
        ref={tabsViewRef}
      />
      </Screen>
    ),
    [routes, onRefresh, onIndexChange, renderHeaderView],
  );
}

export default memo(HomePage);
