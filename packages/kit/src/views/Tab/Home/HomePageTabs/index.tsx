import { memo, useCallback, useMemo, useRef, useState } from 'react';

import { useIntl } from 'react-intl';
import { ScrollView } from 'react-native';

import { Tabs, Text } from '@onekeyhq/components';
import type { ForwardRefHandle } from '@onekeyhq/components/src/CollapsibleTabView/NativeNestedTabView/NestedTabView';

import HeaderView from './HeaderView';
import { HomePageTabsEnum } from './types';

function HomePage() {
  const tabsViewRef = useRef<ForwardRefHandle>(null);
  const [showDemo3, setShowDemo3] = useState(false);
  const intl = useIntl();
  const onRefresh = useCallback(() => {
    tabsViewRef?.current?.setRefreshing(true);
  }, []);

  const onIndexChange = useCallback((index: number) => {}, []);

  const onPageScrollStateChangeCall = useCallback(() => {}, []);

  const onDemo3VisibleChange = useCallback(() => {
    setShowDemo3((pre) => !pre);
  }, []);

  const tabDemo1 = useMemo(
    () => (
      <Tabs.Tab
        name={HomePageTabsEnum.Demo1}
        label={intl.formatMessage({ id: 'form__tools' })}
        key={HomePageTabsEnum.Demo1}
      >
        <ScrollView>
          <Text>demo1</Text>
        </ScrollView>
      </Tabs.Tab>
    ),
    [intl],
  );

  const tabDemo2 = useMemo(
    () => (
      <Tabs.Tab
        name={HomePageTabsEnum.Demo2}
        label={intl.formatMessage({ id: 'form__tools' })}
        key={HomePageTabsEnum.Demo2}
      >
        <ScrollView>
          <Text>demo2</Text>
        </ScrollView>
      </Tabs.Tab>
    ),
    [intl],
  );

  const tabDemo3 = useMemo(
    () => (
      <Tabs.Tab
        name={HomePageTabsEnum.Demo3}
        label={intl.formatMessage({ id: 'form__tools' })}
        key={HomePageTabsEnum.Demo3}
      >
        <ScrollView>
          <Text>demo3</Text>
        </ScrollView>
      </Tabs.Tab>
    ),
    [intl],
  );

  const tabsMap = useMemo(
    () => ({
      [HomePageTabsEnum.Demo1]: tabDemo1,
      [HomePageTabsEnum.Demo2]: tabDemo2,
      [HomePageTabsEnum.Demo3]: tabDemo3,
    }),
    [tabDemo1, tabDemo2, tabDemo3],
  );

  const usedTabs = useMemo(() => {
    const defaultTabsKey = Object.keys(tabsMap) as HomePageTabsEnum[];

    return defaultTabsKey.filter((t) => {
      if (t === HomePageTabsEnum.Demo3) {
        return !showDemo3;
      }
      return true;
    });
  }, [showDemo3, tabsMap]);

  const tabContents = useMemo(
    () => usedTabs.map((t) => tabsMap[t]).filter(Boolean),
    [tabsMap, usedTabs],
  );

  return useMemo(
    () => (
      <Tabs.Container
        stickyTabBar
        initialTabName="Home"
        onRefresh={onRefresh}
        onIndexChange={onIndexChange}
        onPageScrollStateChange={onPageScrollStateChangeCall}
        headerView={<HeaderView switchDemoVisible={onDemo3VisibleChange} />}
        ref={tabsViewRef}
      >
        {tabContents}
      </Tabs.Container>
    ),
    [
      onIndexChange,
      onPageScrollStateChangeCall,
      onRefresh,
      tabContents,
      onDemo3VisibleChange,
    ],
  );
}

export default memo(HomePage);
