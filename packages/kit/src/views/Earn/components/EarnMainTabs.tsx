import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useIsFocused } from '@react-navigation/core';
import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';
import { useSharedValue } from 'react-native-reanimated';

import type { ITabContainerRef } from '@onekeyhq/components';
import {
  ESwitchSize,
  IconButton,
  Popover,
  Switch,
  Tabs,
  XStack,
  YStack,
  rootNavigationRef,
  useScrollContentTabBarOffset,
  useTheme,
} from '@onekeyhq/components';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { ListItem } from '../../../components/ListItem';
import { useIsFirstFocused } from '../../../hooks/useIsFirstFocused';
import { useRouteIsFocused } from '../../../hooks/useRouteIsFocused';
import { useTabContainerWidth } from '../../../hooks/useTabContainerWidth';
import { useEarnHideSmallAssets } from '../hooks/useEarnHideSmallAssets';

import { FAQContent } from './FAQContent';
import { PortfolioTabContent } from './PortfolioTabContent';
import { ProtocolsTabContent } from './ProtocolsTabContent';

import type { IUseEarnPortfolioReturn } from '../hooks/useEarnPortfolio';
import type {
  CollapsibleProps,
  TabBarProps,
} from 'react-native-collapsible-tab-view';

interface IEarnMainTabsProps {
  faqList: Array<{ question: string; answer: string }>;
  isFaqLoading?: boolean;
  containerProps?: Partial<CollapsibleProps>;
  defaultTab?: 'assets' | 'portfolio' | 'faqs';
  portfolioData: IUseEarnPortfolioReturn;
  header?: React.ReactNode;
  tabsRef?: React.RefObject<ITabContainerRef | null>;
  nestedPager?: boolean;
}

const TabContentContainer = ({
  children,
  withHorizontalPadding,
  maxWidth,
  useTabsScrollView = true,
}: {
  children: React.ReactNode;
  withHorizontalPadding?: boolean;
  maxWidth?: number;
  useTabsScrollView?: boolean;
}) => {
  const tabBarHeight = useScrollContentTabBarOffset();

  const content = (
    <YStack
      pt="$6"
      pb="$6"
      gap="$8"
      {...(withHorizontalPadding ? { px: '$5' } : {})}
      {...(maxWidth ? { maxWidth } : {})}
      style={tabBarHeight ? { paddingBottom: tabBarHeight } : undefined}
    >
      {children}
    </YStack>
  );

  if (!useTabsScrollView) {
    return content;
  }

  return (
    <Tabs.ScrollView showsVerticalScrollIndicator={false}>
      {content}
    </Tabs.ScrollView>
  );
};

const EarnMainTabsComponent = ({
  faqList,
  isFaqLoading = false,
  containerProps,
  defaultTab,
  portfolioData,
  header,
  tabsRef: externalTabsRef,
  nestedPager = false,
}: IEarnMainTabsProps) => {
  const intl = useIntl();
  const theme = useTheme();
  const internalTabsRef = useRef<ITabContainerRef>(null);
  const tabsRef = externalTabsRef || internalTabsRef;
  const { hideSmallAssets, setHideSmallAssets } = useEarnHideSmallAssets();
  const useDesktopPageScrollTabs = platformEnv.isDesktop;

  const tabNames = useMemo(
    () => ({
      assets: intl.formatMessage({
        id: ETranslations.earn_available_assets,
      }),
      portfolio: intl.formatMessage({
        id: ETranslations.earn_positions,
      }),
      faqs: intl.formatMessage({ id: ETranslations.global_faqs }),
    }),
    [intl],
  );

  const getTabName = useCallback(
    (tabName: 'assets' | 'portfolio' | 'faqs' | undefined) => {
      if (tabName === 'portfolio') return tabNames.portfolio;
      if (tabName === 'faqs') return tabNames.faqs;
      return tabNames.assets;
    },
    [tabNames],
  );

  const initialTabName = useMemo(() => {
    return getTabName(defaultTab);
  }, [defaultTab, getTabName]);

  const tabNameList = useMemo(
    () => [tabNames.assets, tabNames.portfolio, tabNames.faqs],
    [tabNames.assets, tabNames.faqs, tabNames.portfolio],
  );

  const tabKeyByName = useMemo(() => {
    const map: Record<string, 'assets' | 'portfolio' | 'faqs'> = {};
    (
      Object.entries(tabNames) as Array<[keyof typeof tabNames, string]>
    ).forEach(([key, value]) => {
      map[value] = key;
    });
    return map;
  }, [tabNames]);

  const handleTabChange = useCallback(
    ({ tabName }: { tabName: string }) => {
      const tabKey = tabKeyByName[tabName];
      if (tabKey) {
        rootNavigationRef.current?.setParams?.({
          tab: tabKey,
        });
      }
    },
    [tabKeyByName],
  );

  const desktopFocusedTab = useSharedValue(initialTabName);
  const [desktopTabName, setDesktopTabName] = useState(initialTabName);

  const syncDesktopTabName = useCallback(
    (tabName: string) => {
      desktopFocusedTab.value = tabName;
      setDesktopTabName(tabName);
    },
    [desktopFocusedTab],
  );

  const handleDesktopTabPress = useCallback(
    (tabName: string) => {
      syncDesktopTabName(tabName);
      handleTabChange({ tabName });
    },
    [handleTabChange, syncDesktopTabName],
  );

  useEffect(() => {
    if (!useDesktopPageScrollTabs) {
      return;
    }
    syncDesktopTabName(initialTabName);
  }, [initialTabName, syncDesktopTabName, useDesktopPageScrollTabs]);

  useEffect(() => {
    if (!useDesktopPageScrollTabs) {
      return;
    }

    tabsRef.current = {
      jumpToTab: handleDesktopTabPress,
      setIndex: (index: number) => {
        const tabName = tabNameList[index];
        if (tabName) {
          handleDesktopTabPress(tabName);
        }
      },
      getFocusedTab: () => desktopTabName,
      getCurrentIndex: () =>
        tabNameList.findIndex((name) => name === desktopTabName),
      syncCurrentPage: () => undefined,
    };

    return () => {
      tabsRef.current = null;
    };
  }, [
    desktopTabName,
    handleDesktopTabPress,
    tabNameList,
    tabsRef,
    useDesktopPageScrollTabs,
  ]);

  const isFocused = useRouteIsFocused();
  const isFocusedRef = useRef(isFocused);

  useEffect(() => {
    if (isFocused === isFocusedRef.current) {
      return;
    }
    isFocusedRef.current = isFocused;
    if (defaultTab) {
      const targetTabName = initialTabName;
      if (!useDesktopPageScrollTabs) {
        const currentTabName = tabsRef.current?.getFocusedTab();
        if (currentTabName !== targetTabName) {
          tabsRef.current?.jumpToTab(targetTabName);
        }
      } else if (desktopTabName !== targetTabName) {
        syncDesktopTabName(targetTabName);
      }
    }
  }, [
    defaultTab,
    desktopTabName,
    initialTabName,
    isFocused,
    syncDesktopTabName,
    tabsRef,
    useDesktopPageScrollTabs,
  ]);

  useEffect(() => {
    const callback = ({ tab }: { tab: 'assets' | 'portfolio' | 'faqs' }) => {
      const targetTabName = getTabName(tab);
      if (!useDesktopPageScrollTabs) {
        tabsRef.current?.jumpToTab(targetTabName);
      } else {
        handleDesktopTabPress(targetTabName);
      }
    };
    appEventBus.on(EAppEventBusNames.SwitchEarnTab, callback);
    return () => {
      appEventBus.off(EAppEventBusNames.SwitchEarnTab, callback);
    };
  }, [getTabName, handleDesktopTabPress, tabsRef, useDesktopPageScrollTabs]);

  useEffect(
    () => () => {
      tabsRef.current = null;
    },
    [tabsRef],
  );

  const tabContainerWidth = useTabContainerWidth();

  const renderPortfolioToolbar = useCallback(
    ({ focusedTab }: { focusedTab: string }) =>
      focusedTab === tabNames.portfolio ? (
        <XStack pr="$5">
          <Popover
            title={intl.formatMessage({
              id: ETranslations.defi_display_settings,
            })}
            renderTrigger={
              <IconButton
                testID="earn-handle-tab-press-icon-btn"
                variant="tertiary"
                icon="SliderHorOutline"
                iconSize="$6"
                bg={hideSmallAssets ? '$bgStrong' : 'transparent'}
              />
            }
            renderContent={
              <YStack py="$2.5">
                <ListItem
                  title={intl.formatMessage({
                    id: ETranslations.defi_hide_low_value_positions,
                  })}
                  titleProps={{
                    size: '$bodyMdMedium',
                    color: '$textSubdued',
                  }}
                  childrenBefore={
                    <Switch
                      testID="earn-switch"
                      size={ESwitchSize.small}
                      value={hideSmallAssets}
                      onChange={setHideSmallAssets}
                    />
                  }
                />
              </YStack>
            }
          />
        </XStack>
      ) : null,
    [hideSmallAssets, intl, setHideSmallAssets, tabNames.portfolio],
  );

  const renderTabBar = useCallback(
    (tabBarProps: TabBarProps<string>) => {
      const handleTabPress = (name: string) => {
        tabBarProps.onTabPress?.(name);
      };
      return (
        <Tabs.TabBar
          {...tabBarProps}
          onTabPress={handleTabPress}
          renderToolbar={renderPortfolioToolbar}
        />
      );
    },
    [renderPortfolioToolbar],
  );

  const mergedContainerProps = useMemo<
    Partial<CollapsibleProps> | undefined
  >(() => {
    const mergedHeaderContainerStyle = StyleSheet.flatten(
      containerProps?.headerContainerStyle,
    );
    const headerContainerStyle = {
      backgroundColor: theme.bgApp.val,
      ...mergedHeaderContainerStyle,
    };
    if (!header) {
      return {
        ...containerProps,
        headerContainerStyle,
      };
    }
    const renderHeader = containerProps?.renderHeader;
    return {
      ...containerProps,
      headerContainerStyle,
      renderHeader: (props: TabBarProps<string>) => (
        <YStack>
          {header}
          {renderHeader ? renderHeader(props) : null}
        </YStack>
      ),
    };
  }, [containerProps, header, theme.bgApp.val]);

  if (useDesktopPageScrollTabs) {
    return (
      <YStack>
        <Tabs.TabBar
          tabNames={tabNameList}
          focusedTab={desktopFocusedTab}
          onTabPress={handleDesktopTabPress}
          renderToolbar={renderPortfolioToolbar}
        />
        <YStack
          display={desktopTabName === tabNames.assets ? 'flex' : 'none'}
          pointerEvents={desktopTabName === tabNames.assets ? 'auto' : 'none'}
        >
          <TabContentContainer useTabsScrollView={false}>
            <ProtocolsTabContent />
          </TabContentContainer>
        </YStack>
        <YStack
          display={desktopTabName === tabNames.portfolio ? 'flex' : 'none'}
          pointerEvents={
            desktopTabName === tabNames.portfolio ? 'auto' : 'none'
          }
        >
          <TabContentContainer useTabsScrollView={false}>
            <PortfolioTabContent
              portfolioData={portfolioData}
              hideSmallAssets={hideSmallAssets}
            />
          </TabContentContainer>
        </YStack>
        <YStack
          display={desktopTabName === tabNames.faqs ? 'flex' : 'none'}
          pointerEvents={desktopTabName === tabNames.faqs ? 'auto' : 'none'}
        >
          <TabContentContainer
            withHorizontalPadding
            maxWidth={960}
            useTabsScrollView={false}
          >
            <FAQContent faqList={faqList} isLoading={isFaqLoading} />
          </TabContentContainer>
        </YStack>
      </YStack>
    );
  }

  return (
    <Tabs.Container
      width={platformEnv.isNative ? Number(tabContainerWidth) : undefined}
      ref={tabsRef as any}
      renderTabBar={renderTabBar}
      initialTabName={initialTabName}
      onTabChange={handleTabChange}
      useNativeHeaderAnimation={platformEnv.isNativeAndroid}
      pagerProps={
        nestedPager ? ({ nestedScrollEnabled: true } as any) : undefined
      }
      {...mergedContainerProps}
    >
      <Tabs.Tab name={tabNames.assets}>
        <TabContentContainer>
          <ProtocolsTabContent />
        </TabContentContainer>
      </Tabs.Tab>
      <Tabs.Tab name={tabNames.portfolio}>
        <TabContentContainer>
          <PortfolioTabContent
            portfolioData={portfolioData}
            hideSmallAssets={hideSmallAssets}
          />
        </TabContentContainer>
      </Tabs.Tab>
      <Tabs.Tab name={tabNames.faqs}>
        <TabContentContainer withHorizontalPadding maxWidth={960}>
          <FAQContent faqList={faqList} isLoading={isFaqLoading} />
        </TabContentContainer>
      </Tabs.Tab>
    </Tabs.Container>
  );
};

export const MemoizedEarnMainTabs = memo(EarnMainTabsComponent);

function ForwardedEarnMainTabs(
  props: React.ComponentProps<typeof EarnMainTabsComponent>,
) {
  const isFocused = useIsFocused();
  const isFirstFocused = useIsFirstFocused(isFocused);
  return isFirstFocused ? <EarnMainTabsComponent {...props} /> : null;
}
export const EarnMainTabs = memo(ForwardedEarnMainTabs);
