import { useMemo, useState } from 'react';

import {
  ListView,
  SizableText,
  Stack,
  Tabs,
  XStack,
  YStack,
} from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { Layout } from './utils/Layout';

// Basic Tabs Demo
const BasicTabsDemo = () => {
  const data = useMemo(
    () =>
      new Array(20)
        .fill({})
        .map((_, index) => ({ id: index, title: `Item ${index + 1}` })),
    [],
  );

  return (
    <Tabs.Container>
      <Tabs.Tab name="Tokens">
        <ListView
          data={data}
          scrollEnabled={platformEnv.isWebTouchable}
          disableScrollViewPanResponder
          renderItem={({ item }) => (
            <Stack
              p="$3"
              borderBottomWidth="$px"
              borderBottomColor="$borderSubdued"
            >
              <SizableText>Token: {item.title}</SizableText>
            </Stack>
          )}
        />
      </Tabs.Tab>
      <Tabs.Tab name="NFTs">
        <ListView
          data={data.slice(0, 10)}
          scrollEnabled={platformEnv.isWebTouchable}
          disableScrollViewPanResponder
          renderItem={({ item }) => (
            <Stack
              p="$3"
              borderBottomWidth="$px"
              borderBottomColor="$borderSubdued"
            >
              <SizableText>NFT: {item.title}</SizableText>
            </Stack>
          )}
        />
      </Tabs.Tab>
      <Tabs.Tab name="History">
        <ListView
          data={data.slice(0, 15)}
          scrollEnabled={platformEnv.isWebTouchable}
          disableScrollViewPanResponder
          renderItem={({ item }) => (
            <Stack
              p="$3"
              borderBottomWidth="$px"
              borderBottomColor="$borderSubdued"
            >
              <SizableText>Transaction: {item.title}</SizableText>
            </Stack>
          )}
        />
      </Tabs.Tab>
    </Tabs.Container>
  );
};

// Tabs with Custom Tab Bar Demo
const TabsWithCustomTabBarDemo = () => {
  const data = useMemo(
    () =>
      new Array(30)
        .fill({})
        .map((_, index) => ({ id: index, title: `Data ${index + 1}` })),
    [],
  );

  return (
    <Tabs.Container
      renderTabBar={(props) => (
        <Tabs.TabBar
          {...props}
          // renderToolbar={({ focusedTab }) => (
          //   <XStack ai="center" gap="$2">
          //     <SizableText size="$bodySmMedium" color="$textSubdued">
          //       Current: {focusedTab}
          //     </SizableText>
          //     <IconButton
          //       icon="PlusCircleOutline"
          //       size="small"
          //       onPress={() => {
          //         Toast.success({ title: `Add new item to ${focusedTab}` });
          //       }}
          //     />
          //     <IconButton
          //       icon="SettingsOutline"
          //       size="small"
          //       onPress={() => {
          //         Toast.success({ title: `Settings for ${focusedTab}` });
          //       }}
          //     />
          //   </XStack>
          // )}
        />
      )}
    >
      <Tabs.Tab name="Assets">
        <ListView
          data={data}
          scrollEnabled={platformEnv.isWebTouchable}
          disableScrollViewPanResponder
          renderItem={({ item }) => (
            <Stack
              p="$3"
              borderBottomWidth="$px"
              borderBottomColor="$borderSubdued"
            >
              <SizableText>Asset: {item.title}</SizableText>
            </Stack>
          )}
        />
      </Tabs.Tab>
      <Tabs.Tab name="DeFi">
        <ListView
          data={data.slice(0, 12)}
          scrollEnabled={platformEnv.isWebTouchable}
          disableScrollViewPanResponder
          renderItem={({ item }) => (
            <Stack
              p="$3"
              borderBottomWidth="$px"
              borderBottomColor="$borderSubdued"
            >
              <SizableText>DeFi Protocol: {item.title}</SizableText>
            </Stack>
          )}
        />
      </Tabs.Tab>
    </Tabs.Container>
  );
};

// Tabs with Header Demo
const TabsWithHeaderDemo = () => {
  const data = useMemo(
    () =>
      new Array(25).fill({}).map((_, index) => ({
        id: index,
        title: `Portfolio Item ${index + 1}`,
        value: Math.floor(Math.random() * 10_000),
      })),
    [],
  );

  return (
    <Tabs.Container
      renderHeader={() => (
        <YStack p="$4" bg="$bgSubdued">
          <SizableText size="$headingXl">Portfolio Overview</SizableText>
          <SizableText size="$bodyLg" color="$textSubdued" mt="$1">
            Total Value: $125,432
          </SizableText>
        </YStack>
      )}
    >
      <Tabs.Tab name="Holdings">
        <ListView
          data={data}
          estimatedItemSize="$12"
          scrollEnabled={platformEnv.isWebTouchable}
          disableScrollViewPanResponder
          renderItem={({ item }) => (
            <XStack
              p="$3"
              jc="space-between"
              ai="center"
              borderBottomWidth="$px"
              borderBottomColor="$borderSubdued"
            >
              <SizableText>{item.title}</SizableText>
              <SizableText color="$textSuccess">${item.value}</SizableText>
            </XStack>
          )}
        />
      </Tabs.Tab>
      <Tabs.Tab name="Performance">
        <ListView
          data={data.slice(0, 8)}
          estimatedItemSize="$12"
          scrollEnabled={platformEnv.isWebTouchable}
          disableScrollViewPanResponder
          renderItem={({ item }) => (
            <XStack
              p="$3"
              jc="space-between"
              ai="center"
              borderBottomWidth="$px"
              borderBottomColor="$borderSubdued"
            >
              <SizableText>Performance: {item.title}</SizableText>
              <SizableText color="$textCritical">-${item.value}</SizableText>
            </XStack>
          )}
        />
      </Tabs.Tab>
      <Tabs.Tab name="Analytics">
        <ListView
          data={data.slice(0, 6)}
          estimatedItemSize="$12"
          scrollEnabled={platformEnv.isWebTouchable}
          disableScrollViewPanResponder
          renderItem={({ item }) => (
            <XStack
              p="$3"
              jc="space-between"
              ai="center"
              borderBottomWidth="$px"
              borderBottomColor="$borderSubdued"
            >
              <SizableText>Analytics: {item.title}</SizableText>
              <SizableText color="$textSubdued">{item.value}%</SizableText>
            </XStack>
          )}
        />
      </Tabs.Tab>
    </Tabs.Container>
  );
};

// Tabs with Initial Tab Name Demo
const TabsWithInitialTabDemo = () => {
  const data = useMemo(
    () =>
      new Array(15).fill({}).map((_, index) => ({
        id: index,
        title: `Item ${index + 1}`,
        category: ['Recent', 'Favorites', 'Archive'][
          Math.floor(Math.random() * 3)
        ],
      })),
    [],
  );

  return (
    <Tabs.Container initialTabName="Archive">
      <Tabs.Tab name="Recent">
        <YStack p="$4" gap="$2">
          <SizableText size="$bodyMdMedium" color="$textSubdued">
            Recent items (默认不会显示，因为设置了 initialTabName="Favorites")
          </SizableText>
          <ListView
            data={data.filter((item) => item.category === 'Recent')}
            scrollEnabled={platformEnv.isWebTouchable}
            disableScrollViewPanResponder
            renderItem={({ item }) => (
              <Stack
                p="$3"
                borderBottomWidth="$px"
                borderBottomColor="$borderSubdued"
              >
                <SizableText>📝 Recent: {item.title}</SizableText>
              </Stack>
            )}
          />
        </YStack>
      </Tabs.Tab>
      <Tabs.Tab name="Favorites">
        <YStack p="$4" gap="$2">
          <SizableText size="$bodyMdMedium" color="$textSubdued">
            收藏项目 (默认显示此标签页)
          </SizableText>
          <ListView
            data={data.filter((item) => item.category === 'Favorites')}
            scrollEnabled={platformEnv.isWebTouchable}
            disableScrollViewPanResponder
            renderItem={({ item }) => (
              <Stack
                p="$3"
                borderBottomWidth="$px"
                borderBottomColor="$borderSubdued"
              >
                <SizableText>⭐ Favorite: {item.title}</SizableText>
              </Stack>
            )}
          />
        </YStack>
      </Tabs.Tab>
      <Tabs.Tab name="Archive">
        <YStack p="$4" gap="$2">
          <SizableText size="$bodyMdMedium" color="$textSubdued">
            已归档的项目
          </SizableText>
          <ListView
            data={data.filter((item) => item.category === 'Archive')}
            scrollEnabled={platformEnv.isWebTouchable}
            disableScrollViewPanResponder
            renderItem={({ item }) => (
              <Stack
                p="$3"
                borderBottomWidth="$px"
                borderBottomColor="$borderSubdued"
              >
                <SizableText>📦 Archive: {item.title}</SizableText>
              </Stack>
            )}
          />
        </YStack>
      </Tabs.Tab>
    </Tabs.Container>
  );
};

const TabsWithOnIndexChangeDemo = () => {
  const [activeTabIndex, setActiveTabIndex] = useState(0);
  return (
    <YStack>
      <YStack p="$4" gap="$2">
        <SizableText size="$bodyMdMedium" color="$textSubdued">
          Active tab index: {activeTabIndex}
        </SizableText>
      </YStack>
      <Tabs.Container
        initialTabName="Favorites"
        onIndexChange={(index) => {
          console.log('===>index: ', index);
          setActiveTabIndex(index);
        }}
      >
        <Tabs.Tab name="Recent">
          <YStack p="$4" gap="$2">
            <SizableText size="$bodyMdMedium" color="$textSubdued">
              Recent items (默认不会显示，因为设置了 initialTabName="Favorites")
            </SizableText>
          </YStack>
        </Tabs.Tab>
        <Tabs.Tab name="Favorites">
          <YStack p="$4" gap="$2">
            <SizableText size="$bodyMdMedium" color="$textSubdued">
              Favorites items
            </SizableText>
          </YStack>
        </Tabs.Tab>
        <Tabs.Tab name="Archive">
          <YStack p="$4" gap="$2">
            <SizableText size="$bodyMdMedium" color="$textSubdued">
              Archive items
            </SizableText>
          </YStack>
        </Tabs.Tab>
      </Tabs.Container>
    </YStack>
  );
};

const NewTabsGallery = () => (
  <Layout
    filePath={__CURRENT_FILE_PATH__}
    componentName="NewTabs"
    suggestions={[
      '使用 Tabs.Container 作为容器组件',
      'Tabs.Tab 定义每个标签页的内容',
      'renderTabBar 可以自定义标签栏样式和工具栏',
      'renderHeader 可以添加粘性头部内容',
      'initialTabName 设置默认显示的标签页',
      'ref 可以用来程序化控制标签切换',
      '适用于需要分类展示大量数据的场景',
    ]}
    elements={[
      {
        title: 'Basic Tabs Usage',
        element: (
          <Stack h={400}>
            <BasicTabsDemo />
          </Stack>
        ),
      },
      {
        title: 'Tabs with Custom TabBar & Toolbar',
        element: (
          <Stack h={400}>
            <TabsWithCustomTabBarDemo />
          </Stack>
        ),
      },
      {
        title: 'Tabs with Sticky Header',
        element: (
          <Stack h={400}>
            <TabsWithHeaderDemo />
          </Stack>
        ),
      },
      {
        title: 'Tabs with Initial Tab Name',
        element: (
          <Stack h={400}>
            <TabsWithInitialTabDemo />
          </Stack>
        ),
      },
      {
        title: 'Tabs with OnIndexChange',
        element: (
          <Stack h={400}>
            <TabsWithOnIndexChangeDemo />
          </Stack>
        ),
      },
    ]}
  />
);

export default NewTabsGallery;
