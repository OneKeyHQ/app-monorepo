import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { FlatList } from 'react-native';
import { ScrollView, XStack } from 'tamagui';

import {
  Badge,
  Button,
  Icon,
  Stack,
  TabView,
  Text,
} from '@onekeyhq/components';
import useIsActiveTab from '@onekeyhq/components/src/TabView/hooks/useIsActiveTab';
import type { ForwardRefHandle } from '@onekeyhq/components/src/TabView/NativeTabView/NestedTabView';
import { SceneMap } from '@onekeyhq/components/src/TabView/SceneMap';
import type { Route } from '@onekeyhq/components/src/TabView/types';

import { Layout } from './utils/Layout';
import { TabsFocusTools } from './utils/NavigationTools';
import { FreezeProbe, useFreezeProbe } from './utils/RenderTools';
// import useIsActiveTab from '@onekeyhq/components/src/CollapsibleTabView/hooks/useIsActiveTab';

type Network = {
  id: string;
  name: string;
  impl: string;
  tokenDisplayDecimals: number;
};

function getNetworks(begin = 0) {
  const networks: Network[] = [];
  for (let i = begin; i < begin + 100; i += 1) {
    networks.push({
      id: `${i}`,
      name: `Network ${i}`,
      impl: `Network ${i}`,
      tokenDisplayDecimals: i,
    });
  }
  return networks;
}

let showNetworks = getNetworks();

function TokenList({ networks, name }: { networks: Network[]; name: string }) {
  const isActiveTab = useIsActiveTab(name);

  useFreezeProbe(name, { pause: !isActiveTab });

  useEffect(() => {
    console.log('=====>> TokenList', name, isActiveTab);
  }, [isActiveTab, name]);

  const renderItem = useCallback(
    ({ item }: { item: Network }) => (
      <XStack onPress={() => {}}>
        <Icon name="VolumeUpSolid" />
        <Text>{item.name}</Text>
        <Badge type="success" size="sm">
          {item.impl.toUpperCase()}
        </Badge>
      </XStack>
    ),
    [],
  );

  return useMemo(
    () => (
      <FlatList
        data={networks}
        renderItem={renderItem}
        keyExtractor={(item, index) => `${item.id}-${index}`}
      />
    ),
    [networks, renderItem],
  );
}

const Tab1Scene = () => (
  <ScrollView>
    <FreezeProbe componentName="tab1" />
    <TabsFocusTools componentName="tab1" />
    <Layout
      key="tab1"
      description="可以吸顶左右滑动的 Tabs 组件"
      suggestions={[
        'Tabs.Tab lazy 属性默认为 true，只有当首次滑动到当前页面才会加载',
        'Tabs.Tab autoFreeze 属性默认为 false，离开这个页面的时候冻结页面',
        'Tabs.Tab autoFreeze 也可以传 number。离开这个页面的之后延迟 number 毫秒冻结页面',
        "Tabs.Tab freezeType 属性默认为 'freeze', 用来设置组件冻结的方式, 'freeze' 表示冻结，已经运行的 useEffect 还会继续运行，不会再执行新的 useEffect，解冻后会重新运行。'unmount' 会卸载页面，下次进入会重新加载",
        '支持 headerView 属性，可以自定义头部视图，可以是任意组件，',
        'headerView 会随着滑动自动吸顶，不需要手动处理',
      ]}
      boundaryConditions={[
        'headerView 的背景颜色不能使用 RGBA 格式的颜色，要是用 RGB 色',
        'headerView 会随着滑动自动吸顶，不需要手动处理',
        '建议不常用的并且复杂的页面一定记得设定 autoFreeze 属性，不要影响整体性能',
        '目前只支持直接嵌套 ScrollView、FlatList、SectionList',
        '放置普通组件需要使用 ScrollView 包裹',
        'headerView 高度尽量固定，切换高度时低端设备可能会闪一下。',
      ]}
      elements={[
        {
          title: '默认状态',
          element: (
            <Stack space="$1">
              <Text variant="$bodyMd">我是一个内容</Text>
            </Stack>
          ),
        },
      ]}
    />
  </ScrollView>
);

const Tab2Scene = () => <TokenList name="tab2" networks={showNetworks} />;

const Tab3Scene = () => (
  <ScrollView>
    <TabsFocusTools componentName="tab3" />
    <Text variant="$bodyMd">Network 1</Text>
    <TokenList name="tab3" networks={showNetworks} />

    <Text variant="$bodyMd">Network 2</Text>
    <TokenList name="tab3" networks={showNetworks} />

    <Text variant="$bodyMd">End</Text>
  </ScrollView>
);

const Tab4Scene = () => (
  <ScrollView>
    {showNetworks.flatMap((item, index) => (
      <Text variant="$bodyMd" key={`tab4-network-${index}`}>
        {`${item.name}`}
      </Text>
    ))}
    <FreezeProbe componentName="tab4" />
    <TabsFocusTools componentName="tab4" />
  </ScrollView>
);

const Tab5Scene = () => (
  <ScrollView>
    <FreezeProbe componentName="tab5" />
    <TabsFocusTools componentName="tab5" />
    <Text variant="$bodyMd">ScrollView Simple</Text>
    {showNetworks.flatMap((item, index) => (
      <XStack onPress={() => {}} key={`tab5-network-${index}`}>
        <Icon name="VolumeUpSolid" />
        <Text>{item.name}</Text>
        <Text>{item.tokenDisplayDecimals}</Text>
        <Badge type="info" size="sm">
          {item.impl}
        </Badge>
      </XStack>
    ))}
    <Text variant="$bodyMd">End</Text>
  </ScrollView>
);

const Tab6Scene = () => <Text>Tab</Text>;
const Tab7Scene = () => <Text>Tab</Text>;
const Tab8Scene = () => <Text>Tab</Text>;

const renderScene = SceneMap({
  tab1: Tab1Scene,
  tab2: Tab2Scene,
  tab3: Tab3Scene,
  tab4: Tab4Scene,
  tab5: Tab5Scene,
  tab6: Tab6Scene,
  tab7: Tab7Scene,
  tab8: Tab8Scene,
});

function CollapsibleTabView() {
  const [headerHighMode, setHeaderHighMode] = useState(true);
  const tabsViewRef = useRef<ForwardRefHandle>(null);

  const headerHeightCall = useCallback(() => {
    setHeaderHighMode((pre) => !pre);
  }, []);

  const loadMoreDataCall = useCallback(() => {
    showNetworks = [...showNetworks, ...getNetworks(showNetworks.length)];
  }, []);

  useEffect(() => {
    setTimeout(() => {
      tabsViewRef?.current?.setPageIndex(0);
    });
  }, []);

  const renderHeaderViewCall = useCallback(
    () => (
      <Stack alignItems="center" justifyContent="center" py="$4">
        <Text>Header View Simple</Text>
        <Text>{`Header Height ${headerHighMode.toString()}`}</Text>
        <Text>{`Item Count ${showNetworks.length}`}</Text>
        {headerHighMode && <Text py="$10">我个子很高</Text>}
        <Button onPress={headerHeightCall}>切换高度</Button>
        <Button onPress={loadMoreDataCall}>添加数据</Button>
      </Stack>
    ),
    [headerHighMode, headerHeightCall, loadMoreDataCall],
  );

  const [routes] = useState<Route[]>([
    { key: 'tab1', title: 'Tab1' },
    { key: 'tab2', title: 'Tab2' },
    { key: 'tab3', title: 'Tab3' },
    { key: 'tab4', title: 'Tab4', autoFreeze: 15 * 1000 },
    { key: 'tab5', title: 'Tab5', autoFreeze: 10 * 1000 },
    { key: 'tab6', title: 'Tab6' },
    { key: 'tab7', title: 'Tab7' },
    { key: 'tab8', title: 'Tab8' },
  ]);

  return useMemo(
    () => (
      <Stack flex={1}>
        <TabView
          ref={tabsViewRef}
          lazy
          navigationState={{ routes }}
          onIndexChange={() => {}}
          renderScene={renderScene}
          renderHeaderView={renderHeaderViewCall}
        />
      </Stack>
    ),
    [renderHeaderViewCall, routes],
  );
}

export default memo(CollapsibleTabView);
