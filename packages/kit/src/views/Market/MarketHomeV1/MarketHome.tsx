import { useCallback, useMemo } from 'react';

import {
  Icon,
  Page,
  Spinner,
  Stack,
  Tabs,
  YStack,
  useMedia,
} from '@onekeyhq/components';
import { EJotaiContextStoreNames } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { ETabRoutes } from '@onekeyhq/shared/src/routes';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { AccountSelectorProviderMirror } from '../../../components/AccountSelector';
import { TabPageHeader } from '../../../components/TabPageHeader';
import { usePromiseResult } from '../../../hooks/usePromiseResult';
import { MarketHomeList } from '../components/MarketHomeList';
import { MarketWatchList } from '../components/MarketWatchList';
import { MarketWatchListProviderMirror } from '../MarketWatchListProviderMirror';

function MarketHome() {
  const { result: categories } = usePromiseResult(
    () => backgroundApiProxy.serviceMarket.fetchCategories(),
    [],
    {
      revalidateOnReconnect: true,
    },
  );

  const tabConfig = useMemo(
    () =>
      categories?.map((category, index) => ({
        title: category.name,
        // eslint-disable-next-line react/no-unstable-nested-components
        page:
          index === 0 ? (
            <MarketWatchList category={category} />
          ) : (
            <MarketHomeList category={category} tabIndex={index} />
          ),
      })) || [],
    [categories],
  );

  const { gtMd } = useMedia();
  const handleSelectedPageIndex = useCallback((index: number) => {
    // ref?.current?.setIsSelected?.(index === 0);
    appEventBus.emit(EAppEventBusNames.SwitchMarketHomeTab, {
      tabIndex: index,
    });
  }, []);
  const renderTabContainer = useCallback(() => {
    if (!tabConfig.length) {
      return (
        <Stack flex={1} ai="center" jc="center">
          <Spinner size="large" />
        </Stack>
      );
    }
    return (
      <Tabs.Container
        pagerProps={{
          offscreenPageLimit: 8,
        }}
        renderTabBar={(props) => (
          <Tabs.TabBar
            {...props}
            scrollable
            renderItem={(
              { name, isFocused, onPress, tabItemStyle, focusedTabStyle },
              index,
            ) =>
              !gtMd && index === 0 ? (
                <YStack
                  ai="center"
                  jc="center"
                  ml="$4"
                  onPress={() => onPress(name)}
                >
                  <Icon
                    name="StarOutline"
                    color={isFocused ? '$text' : '$textSubdued'}
                    size="$4.5"
                    px="$1"
                  />
                  {isFocused ? (
                    <YStack
                      position="absolute"
                      bottom={0}
                      left={0}
                      right={0}
                      h="$0.5"
                      bg="$text"
                      borderRadius={1}
                    />
                  ) : null}
                </YStack>
              ) : (
                <Tabs.TabBarItem
                  name={name}
                  isFocused={isFocused}
                  onPress={onPress}
                  tabItemStyle={tabItemStyle}
                  focusedTabStyle={focusedTabStyle}
                />
              )
            }
          />
        )}
        onIndexChange={handleSelectedPageIndex}
      >
        {tabConfig.map((tab) => (
          <Tabs.Tab key={tab.title} name={tab.title}>
            {platformEnv.isNative ? (
              tab.page
            ) : (
              <Tabs.ScrollView
                scrollEnabled={false}
                contentContainerStyle={{ overflow: 'hidden' }}
              >
                {tab.page}
              </Tabs.ScrollView>
            )}
          </Tabs.Tab>
        ))}
      </Tabs.Container>
    );
  }, [gtMd, handleSelectedPageIndex, tabConfig]);

  return (
    <Page>
      <TabPageHeader
        sceneName={EAccountSelectorSceneName.home}
        tabRoute={ETabRoutes.Market}
      />
      <Page.Body>{renderTabContainer()}</Page.Body>
    </Page>
  );
}

export default function MarketHomeWithProvider() {
  return (
    <AccountSelectorProviderMirror
      config={{
        sceneName: EAccountSelectorSceneName.home,
        sceneUrl: '',
      }}
      enabledNum={[0]}
    >
      <MarketWatchListProviderMirror
        storeName={EJotaiContextStoreNames.marketWatchList}
      >
        <MarketHome />
      </MarketWatchListProviderMirror>
    </AccountSelectorProviderMirror>
  );
}
