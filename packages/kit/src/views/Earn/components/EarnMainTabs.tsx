import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
} from 'react';

import { useIsFocused } from '@react-navigation/core';
import { useIntl } from 'react-intl';
import { View } from 'react-native';
import PagerView from 'react-native-pager-view';

import {
  XStack,
  YStack,
  rootNavigationRef,
  useScrollContentTabBarOffset,
} from '@onekeyhq/components';
import { TabBar } from '@onekeyhq/components/src/composite/TabBar';
import { useAppPagerController } from '@onekeyhq/kit/src/components/AppPager/useAppPagerController';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { useIsFirstFocused } from '../../../hooks/useIsFirstFocused';
import { useRouteIsFocused } from '../../../hooks/useRouteIsFocused';
import { useEarnHideSmallAssets } from '../hooks/useEarnHideSmallAssets';

import { EarnPortfolioSettings } from './EarnPortfolioSettings';
import { FAQContent } from './FAQContent';
import { PortfolioTabContent } from './PortfolioTabContent';
import { ProtocolsTabContent } from './ProtocolsTabContent';

import type { IUseEarnPortfolioReturn } from '../hooks/useEarnPortfolio';

type IEarnTabKey = 'assets' | 'portfolio' | 'faqs';

interface IEarnMainTabsProps {
  faqList: Array<{ question: string; answer: string }>;
  isFaqLoading?: boolean;
  defaultTab?: IEarnTabKey;
  portfolioData: IUseEarnPortfolioReturn;
  isActive?: boolean;
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
};

const EarnMainTabsComponent = ({
  faqList,
  isFaqLoading = false,
  defaultTab,
  portfolioData,
  isActive = true,
}: IEarnMainTabsProps) => {
  const intl = useIntl();
  const pagerRef = useRef<PagerView>(null);
  const { hideSmallAssets } = useEarnHideSmallAssets();

  const tabNames = useMemo(
    () => ({
      assets: intl.formatMessage({ id: ETranslations.earn_available_assets }),
      portfolio: intl.formatMessage({ id: ETranslations.earn_positions }),
      faqs: intl.formatMessage({ id: ETranslations.global_faqs }),
    }),
    [intl],
  );
  const pages = useMemo(
    () =>
      (['assets', 'portfolio', 'faqs'] as const).map((key) => ({
        key,
        name: tabNames[key],
      })),
    [tabNames],
  );
  const initialTabName = tabNames[defaultTab ?? 'assets'];
  const { initialIndex, selectedIndex, focusedTab, indexDecimal, selectIndex } =
    useAppPagerController({
      pages,
      initialTabName,
      pagerRef,
      animationEnabled: false,
    });

  // Sync only the committed selection: batched web pager commands can race
  // against its previous page before React commits their intermediate state.
  useLayoutEffect(() => {
    indexDecimal.value = selectedIndex;
    pagerRef.current?.setPageWithoutAnimation(selectedIndex);
  }, [indexDecimal, selectedIndex]);

  const handleTabPress = useCallback(
    (tabName: string) => {
      const index = pages.findIndex((item) => item.name === tabName);
      if (index < 0) return;
      selectIndex(index, false);
      rootNavigationRef.current?.setParams?.({ tab: pages[index].key });
    },
    [pages, selectIndex],
  );

  const defaultIndex = pages.findIndex(
    (page) => page.key === (defaultTab ?? 'assets'),
  );
  useEffect(() => {
    selectIndex(defaultIndex, false);
  }, [defaultIndex, selectIndex]);

  const isFocused = useRouteIsFocused();
  const wasFocusedRef = useRef(isFocused);
  useEffect(() => {
    const wasFocused = wasFocusedRef.current;
    wasFocusedRef.current = isFocused;
    if (isFocused && !wasFocused && defaultTab) {
      selectIndex(defaultIndex, false);
    }
  }, [defaultIndex, defaultTab, isFocused, selectIndex]);

  useEffect(() => {
    const callback = ({ tab }: { tab: IEarnTabKey }) => {
      handleTabPress(tabNames[tab]);
    };
    appEventBus.on(EAppEventBusNames.SwitchEarnTab, callback);
    return () => {
      appEventBus.off(EAppEventBusNames.SwitchEarnTab, callback);
    };
  }, [handleTabPress, tabNames]);

  const renderPortfolioToolbar = useCallback(
    ({ focusedTab: tabName }: { focusedTab: string }) =>
      tabName === tabNames.portfolio ? (
        <XStack pr="$5">
          <EarnPortfolioSettings />
        </XStack>
      ) : null,
    [tabNames.portfolio],
  );
  const isAssetsTabActive = isActive && pages[selectedIndex]?.key === 'assets';

  return (
    <YStack>
      <TabBar
        tabNames={pages.map((page) => page.name)}
        focusedTab={focusedTab}
        indexDecimal={indexDecimal}
        onTabPress={handleTabPress}
        renderToolbar={renderPortfolioToolbar}
      />
      <PagerView
        ref={pagerRef}
        initialPage={initialIndex}
        scrollEnabled={false}
      >
        <View key="assets" collapsable={false}>
          <YStack display={selectedIndex === 0 ? 'flex' : 'none'}>
            <TabContentContainer>
              <ProtocolsTabContent isActive={isAssetsTabActive} />
            </TabContentContainer>
          </YStack>
        </View>
        <View key="portfolio" collapsable={false}>
          <YStack display={selectedIndex === 1 ? 'flex' : 'none'}>
            <TabContentContainer>
              <PortfolioTabContent
                portfolioData={portfolioData}
                hideSmallAssets={hideSmallAssets}
              />
            </TabContentContainer>
          </YStack>
        </View>
        <View key="faqs" collapsable={false}>
          <YStack display={selectedIndex === 2 ? 'flex' : 'none'}>
            <TabContentContainer withHorizontalPadding maxWidth={960}>
              <FAQContent faqList={faqList} isLoading={isFaqLoading} />
            </TabContentContainer>
          </YStack>
        </View>
      </PagerView>
    </YStack>
  );
};

function ForwardedEarnMainTabs(props: IEarnMainTabsProps) {
  const isFocused = useIsFocused();
  const isFirstFocused = useIsFirstFocused(isFocused);
  return isFirstFocused ? <EarnMainTabsComponent {...props} /> : null;
}
export const EarnMainTabs = memo(ForwardedEarnMainTabs);
