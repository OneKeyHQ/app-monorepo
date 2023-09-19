import { useCallback, useMemo, useState } from 'react';
import type { ReactElement } from 'react';

import { FlatList, SafeAreaView } from 'react-native';
import { ScrollView, XStack } from 'tamagui';

import {
  Badge,
  Button,
  Icon,
  Stack,
  Tabs,
  Text,
  YStack,
} from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { Layout } from './utils/Layout';

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

function TokenList({ networks }: { networks: Network[] }) {
  console.log();

  const renderItem = useCallback(
    ({ item }: { item: Network }) => (
      <XStack onPress={() => {}}>
        <Icon name="AcademicCapMini" />
        <Text>{item.name}</Text>
        <Badge type="success" size="sm">
          {item.impl.toUpperCase()}
        </Badge>
      </XStack>
    ),
    [],
  );

  return (
    <FlatList
      data={networks}
      renderItem={renderItem}
      keyExtractor={(item, index) => `${item.id}-${index}`}
    />
  );
}

function ContainerView({ children }: { children: ReactElement }) {
  if (platformEnv.isNative) {
    return <SafeAreaView>{children}</SafeAreaView>;
  }
  return children;
}

function CollapsibleTabView() {
  const [showNetworks, setShowNetworks] = useState<Network[]>(getNetworks());

  const [headerHighMode, setHeaderHighMode] = useState(true);

  const headerHeightCall = useCallback(() => {
    setHeaderHighMode((pre) => {
      return !pre;
    });
  }, []);

  const loadMoreDataCall = useCallback(() => {
    setShowNetworks((pre) => [...pre, ...getNetworks(pre.length)]);
  }, []);

  const headerView = useMemo(
    () => (
      <Stack
        backgroundColor="$bgHover"
        alignItems="center"
        justifyContent="center"
        py="$4"
      >
        <Text>Header View Simple</Text>
        <Text>{`Header Height ${headerHighMode}`}</Text>
        <Text>{`Item Count ${showNetworks.length}`}</Text>
        {headerHighMode && <Text py="$10">我个子很高</Text>}
        <Button onPress={headerHeightCall}>
          <Button.Text>切换高度</Button.Text>
        </Button>
        <Button onPress={loadMoreDataCall}>
          <Button.Text>添加数据</Button.Text>
        </Button>
      </Stack>
    ),
    [headerHighMode, showNetworks.length, headerHeightCall, loadMoreDataCall],
  );

  return (
    <Stack flex={1} width="100%" height="100%" backgroundColor="$bgHovered">
      <ContainerView>
        <Tabs.Container headerView={headerView}>
          <Tabs.Tab name="tab1" label="我是 Tab1">
            <Layout
              key="tab1"
              description="可以吸顶左右滑动的 Tabs 组件"
              suggestions={[
                'Tabs.Tab autoDestroy 属性可以控制 Tab 内容销毁时间',
                '支持 headerView 属性，可以自定义头部视图，可以是任意组件，',
                'headerView 会随着滑动自动吸顶，不需要手动处理',
              ]}
              boundaryConditions={[
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
          </Tabs.Tab>

          <Tabs.Tab name="tab2" label="我是 Tab2">
            <TokenList networks={showNetworks} />
          </Tabs.Tab>

          <Tabs.Tab name="tab3" label="我是 Tab3">
            <ScrollView>
              <Text variant="$bodyMd">Network 1</Text>
              <TokenList networks={showNetworks} />

              <Text variant="$bodyMd">Network 2</Text>
              <TokenList networks={showNetworks} />

              <Text variant="$bodyMd">End</Text>
            </ScrollView>
          </Tabs.Tab>

          <Tabs.Tab name="tab4" label="我是 Tab4">
            <ScrollView>
              {showNetworks.flatMap((item, index) => (
                <Text variant="$bodyMd" key={`tab4-network-${index}`}>
                  {`${item.name}`}
                </Text>
              ))}
            </ScrollView>
          </Tabs.Tab>

          <Tabs.Tab name="tab5" label="我是 Tab5" autoDestroy={3 * 1000 * 60}>
            <ScrollView>
              <Text variant="$bodyMd">ScrollView Simple</Text>
              {showNetworks.flatMap((item, index) => (
                <XStack onPress={() => {}} key={`tab5-network-${index}`}>
                  <Icon name="AcademicCapMini" />
                  <Text>{item.name}</Text>
                  <Text>{item.tokenDisplayDecimals}</Text>
                  <Badge type="info" size="sm">
                    {item.impl.toUpperCase()}
                  </Badge>
                </XStack>
              ))}
              <Text variant="$bodyMd">End</Text>
            </ScrollView>
          </Tabs.Tab>
        </Tabs.Container>
      </ContainerView>
    </Stack>
  );
}

export default CollapsibleTabView;
