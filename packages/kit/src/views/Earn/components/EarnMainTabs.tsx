import { memo, useCallback, useEffect, useMemo, useRef } from 'react';

import { useIsFocused } from '@react-navigation/core';
import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';

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
  useTabContainerWidth,
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
}: {
  children: React.ReactNode;
  withHorizontalPadding?: boolean;
  maxWidth?: number;
}) => {
  const tabBarHeight = useScrollContentTabBarOffset();
  return (
    <Tabs.ScrollView showsVerticalScrollIndicator={false}>
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

  const isFocused = useRouteIsFocused();
  const isFocusedRef = useRef(isFocused);

  useEffect(() => {
    if (isFocused === isFocusedRef.current) {
      return;
    }
    isFocusedRef.current = isFocused;
    if (defaultTab && tabsRef.current) {
      const targetTabName = initialTabName;
      const currentTabName = tabsRef.current.getFocusedTab();
      if (currentTabName !== targetTabName) {
        tabsRef.current.jumpToTab(targetTabName);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultTab, initialTabName, isFocused]);

  useEffect(() => {
    const callback = ({ tab }: { tab: 'assets' | 'portfolio' | 'faqs' }) => {
      if (tabsRef.current) {
        tabsRef.current.jumpToTab(getTabName(tab));
      }
    };
    appEventBus.on(EAppEventBusNames.SwitchEarnTab, callback);
    return () => {
      appEventBus.off(EAppEventBusNames.SwitchEarnTab, callback);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [getTabName]);

  useEffect(
    () => () => {
      tabsRef.current = null;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const tabContainerWidth = useTabContainerWidth();

  const renderTabBar = useCallback(
    (tabBarProps: TabBarProps<string>) => {
      const handleTabPress = (name: string) => {
        tabBarProps.onTabPress?.(name);
      };
      return (
        <Tabs.TabBar
          {...tabBarProps}
          onTabPress={handleTabPress}
          renderToolbar={({ focusedTab }) =>
            focusedTab === tabNames.portfolio ? (
              <XStack pr="$5">
                <Popover
                  title={intl.formatMessage({
                    id: ETranslations.defi_display_settings,
                  })}
                  renderTrigger={
                    <IconButton
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
            ) : null
          }
        />
      );
    },
    [hideSmallAssets, intl, setHideSmallAssets, tabNames.portfolio],
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
