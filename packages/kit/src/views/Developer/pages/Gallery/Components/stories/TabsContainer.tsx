import { SizableText, Stack, Tabs, XStack, YStack } from '@onekeyhq/components';

import { Layout } from './utils/Layout';

const TabsContainerGallery = () => {
  // Sample data for demo
  const sampleData = Array.from({ length: 20 }, (_, i) => ({
    id: i,
    title: `Item ${i + 1}`,
    description: `This is the description for item ${i + 1}`,
  }));

  const renderHeader = () => (
    <Stack bg="$bgInfoStrong" p="$4" mb="$4">
      <SizableText size="$bodyLgMedium" color="$white" textAlign="center">
        Custom Header Component
      </SizableText>
    </Stack>
  );

  const renderToolbar = ({ focusedTab }: { focusedTab: string }) => (
    <XStack p="$2" justifyContent="center" alignItems="center">
      <SizableText size="$bodySm" color="$textSubdued">
        Current: {focusedTab}
      </SizableText>
    </XStack>
  );

  return (
    <Layout
      componentName="Tabs.Container"
      filePath={__CURRENT_FILE_PATH__}
      description="新版的标签页容器组件，支持跨平台使用，提供了统一的 API 和更好的性能优化"
      suggestions={[
        '推荐在需要多个标签页切换的场景中使用',
        '支持自定义头部、标签栏和工具栏',
        '具有良好的跨平台兼容性',
        '支持回调函数来监听标签切换事件',
      ]}
      boundaryConditions={[
        '每个 Tab 必须提供 name 属性作为标识',
        '标签页内容应当合理控制高度以避免布局问题',
        '在移动端使用时注意性能优化',
      ]}
      elements={[
        {
          title: '基础用法',
          description: '展示 Tabs.Container 的基本使用方式，包含三个标签页',
          element: (
            <Stack height={400} borderWidth={1} borderColor="$borderColor">
              <Tabs.Container
                renderHeader={renderHeader}
                renderTabBar={(props) => (
                  <Tabs.TabBar {...props} renderToolbar={renderToolbar} />
                )}
                onIndexChange={(index) => {
                  console.log('Tab index changed:', index);
                }}
                onTabChange={({ tabName, index }) => {
                  console.log('Tab changed:', tabName, index);
                }}
              >
                <Tabs.Tab name="Crypto">
                  <Stack
                    flex={1}
                    p="$4"
                    justifyContent="center"
                    alignItems="center"
                  >
                    <SizableText size="$headingXl" fontWeight="600" mb="$4">
                      Crypto Assets
                    </SizableText>
                    <YStack gap="$2" maxHeight={200} overflow="scroll">
                      {sampleData.slice(0, 6).map((item) => (
                        <Stack
                          key={item.id}
                          p="$3"
                          bg="$bg"
                          borderWidth={1}
                          borderColor="$borderColor"
                        >
                          <SizableText fontWeight="600">
                            {item.title}
                          </SizableText>
                          <SizableText size="$bodySm" color="$textSubdued">
                            {item.description}
                          </SizableText>
                        </Stack>
                      ))}
                    </YStack>
                  </Stack>
                </Tabs.Tab>

                <Tabs.Tab name="NFT">
                  <Stack
                    flex={1}
                    p="$4"
                    justifyContent="center"
                    alignItems="center"
                  >
                    <SizableText size="$headingXl" fontWeight="600" mb="$4">
                      NFT Collection
                    </SizableText>
                    <XStack gap="$2" flexWrap="wrap" justifyContent="center">
                      {Array.from({ length: 6 }, (_, i) => (
                        <Stack
                          key={i}
                          width={80}
                          height={80}
                          bg="$bgStrong"
                          justifyContent="center"
                          alignItems="center"
                          mb="$2"
                        >
                          <SizableText size="$bodySm">NFT #{i + 1}</SizableText>
                        </Stack>
                      ))}
                    </XStack>
                  </Stack>
                </Tabs.Tab>

                <Tabs.Tab name="History">
                  <Stack flex={1} p="$4">
                    <SizableText
                      size="$headingXl"
                      fontWeight="600"
                      mb="$4"
                      textAlign="center"
                    >
                      Transaction History
                    </SizableText>
                    <YStack gap="$2" flex={1}>
                      {sampleData.slice(0, 4).map((item) => (
                        <XStack
                          key={item.id}
                          p="$3"
                          bg="$bg"
                          borderWidth={1}
                          borderColor="$borderColor"
                          justifyContent="space-between"
                          alignItems="center"
                        >
                          <YStack>
                            <SizableText fontWeight="600">
                              {item.title}
                            </SizableText>
                            <SizableText size="$bodySm" color="$textSubdued">
                              {item.description}
                            </SizableText>
                          </YStack>
                          <SizableText size="$bodySm" color="$textSuccess">
                            +$100.00
                          </SizableText>
                        </XStack>
                      ))}
                    </YStack>
                  </Stack>
                </Tabs.Tab>
              </Tabs.Container>
            </Stack>
          ),
        },
        {
          title: '自定义标签栏',
          description: '展示如何自定义标签栏样式和工具栏',
          element: (
            <Stack
              w="100%"
              height={300}
              borderWidth={1}
              borderColor="$borderColor"
            >
              <Tabs.Container
                renderTabBar={(props) => (
                  <Tabs.TabBar
                    {...props}
                    tabItemStyle={{
                      backgroundColor: '$bgStrong',
                      marginHorizontal: '$1',
                    }}
                    focusedTabStyle={{
                      backgroundColor: '$bgActive',
                    }}
                    renderToolbar={() => (
                      <Stack p="$2">
                        <SizableText size="$bodySm" color="$textSubdued">
                          Custom Toolbar
                        </SizableText>
                      </Stack>
                    )}
                  />
                )}
              >
                <Tabs.Tab name="Tab A">
                  <Stack flex={1} justifyContent="center" alignItems="center">
                    <SizableText size="$headingXl">Content A</SizableText>
                    <SizableText color="$textSubdued">
                      This is content for Tab A
                    </SizableText>
                  </Stack>
                </Tabs.Tab>

                <Tabs.Tab name="Tab B">
                  <Stack flex={1} justifyContent="center" alignItems="center">
                    <SizableText size="$headingXl">Content B</SizableText>
                    <SizableText color="$textSubdued">
                      This is content for Tab B
                    </SizableText>
                  </Stack>
                </Tabs.Tab>

                <Tabs.Tab name="Tab C">
                  <Stack flex={1} justifyContent="center" alignItems="center">
                    <SizableText size="$headingXl">Content C</SizableText>
                    <SizableText color="$textSubdued">
                      This is content for Tab C
                    </SizableText>
                  </Stack>
                </Tabs.Tab>
              </Tabs.Container>
            </Stack>
          ),
        },
        {
          title: '简单标签页',
          description: '最简单的标签页使用方式，不带额外的头部和工具栏',
          element: (
            <Stack height={250} borderWidth={1} borderColor="$borderColor">
              <Tabs.Container>
                <Tabs.Tab name="Page 1">
                  <Stack flex={1} justifyContent="center" alignItems="center">
                    <SizableText size="$headingLg">Page 1 Content</SizableText>
                    <SizableText color="$textSubdued">
                      Simple tab content
                    </SizableText>
                  </Stack>
                </Tabs.Tab>

                <Tabs.Tab name="Page 2">
                  <Stack flex={1} justifyContent="center" alignItems="center">
                    <SizableText size="$headingLg">Page 2 Content</SizableText>
                    <SizableText color="$textSubdued">
                      Another tab content
                    </SizableText>
                  </Stack>
                </Tabs.Tab>
              </Tabs.Container>
            </Stack>
          ),
        },
      ]}
    />
  );
};

export default TabsContainerGallery;
