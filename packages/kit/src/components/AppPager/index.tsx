import {
  useCallback,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { ReactNode, Ref } from 'react';

import { View } from 'react-native';
import {
  NativeScroller,
  WebCollapsiblePagerView,
  useWebCollapsiblePagerPage,
} from 'react-native-pager-view';

import { ScrollContentRegistrationContext } from '@onekeyhq/components/src/composite/ScrollContentRegistration';

import { AppPagerContext, AppPagerPageContext } from './context';
import { useAppPagerController } from './useAppPagerController';

import type {
  IAppPagerChange,
  IAppPagerPage,
  IAppPagerRef,
  IAppPagerTabBarProps,
} from './types';

export type IAppPagerProps = {
  ref?: Ref<IAppPagerRef>;
  pages: readonly IAppPagerPage[];
  renderHeader?: () => ReactNode;
  renderTabBar?: (props: IAppPagerTabBarProps) => ReactNode;
  renderSubHeader?: () => ReactNode;
  initialTabName?: string;
  onTabChange?: (event: IAppPagerChange) => void;
  onIndexChange?: (index: number) => void;
  disableScroll?: boolean;
  isRouteFocused?: boolean;
};

function AppPagerPage({
  page,
  resetGeneration,
  renderSubHeader,
}: {
  page: IAppPagerPage;
  resetGeneration: number;
  renderSubHeader?: () => ReactNode;
}) {
  const sdkPage = useWebCollapsiblePagerPage();
  return (
    <AppPagerPageContext.Provider
      value={useMemo(
        () => ({
          key: page.key,
          name: page.name,
          isFocused: sdkPage?.isFocused ?? true,
        }),
        [page.key, page.name, sdkPage?.isFocused],
      )}
    >
      <ScrollContentRegistrationContext.Provider
        value={sdkPage?.registerContent}
      >
        <NativeScroller
          pagerScrollKey={`${page.key}:${resetGeneration}`}
          style={{ flex: 1 }}
        >
          {sdkPage?.isFocused ? renderSubHeader?.() : null}
          {page.children}
        </NativeScroller>
      </ScrollContentRegistrationContext.Provider>
    </AppPagerPageContext.Provider>
  );
}

export function AppPager({
  ref,
  pages,
  renderHeader,
  renderTabBar,
  renderSubHeader,
  initialTabName,
  onTabChange,
  onIndexChange,
  disableScroll,
  isRouteFocused = true,
}: IAppPagerProps) {
  const pagerRef = useRef<WebCollapsiblePagerView>(null);
  const controller = useAppPagerController({
    pages,
    initialTabName,
    pagerRef,
    onSelectionChange: (event) => {
      onTabChange?.(event);
    },
  });
  const [resetGeneration, setResetGeneration] = useState(0);
  const scrollToTop = useCallback(
    () => setResetGeneration((value) => value + 1),
    [],
  );
  const {
    setIndex,
    jumpToTab,
    getCurrentIndex,
    getFocusedTab,
    syncCurrentPage,
  } = controller;
  useImperativeHandle(
    ref,
    () => ({
      setIndex,
      jumpToTab,
      getCurrentIndex,
      getFocusedTab,
      syncCurrentPage,
      restoreScrollPosition: () =>
        pagerRef.current?.restoreScrollPosition() ?? false,
    }),
    [setIndex, jumpToTab, getCurrentIndex, getFocusedTab, syncCurrentPage],
  );
  const context = useMemo(
    () => ({ focusedName: controller.focusedName, scrollToTop }),
    [controller.focusedName, scrollToTop],
  );
  return (
    <AppPagerContext.Provider value={context}>
      <WebCollapsiblePagerView
        ref={pagerRef}
        style={{ flex: 1 }}
        initialPage={controller.initialIndex}
        scrollEnabled={!disableScroll}
        isActive={isRouteFocused}
        pageRetentionDistance={pages.length}
        header={renderHeader?.()}
        stickyHeader={renderTabBar?.({
          focusedTab: controller.focusedTab,
          indexDecimal: controller.indexDecimal,
          tabNames: pages.map((page) => page.name),
          onTabPress: jumpToTab,
        })}
        onPageScroll={({ nativeEvent }) => {
          controller.indexDecimal.value =
            nativeEvent.position + nativeEvent.offset;
        }}
        onPageSelected={({ nativeEvent }) => {
          if (!pages[nativeEvent.position]) return;
          onIndexChange?.(nativeEvent.position);
          controller.selectIndex(nativeEvent.position);
        }}
      >
        {pages.map((page) => (
          <View key={page.key} style={{ flex: 1 }}>
            <AppPagerPage
              page={page}
              resetGeneration={resetGeneration}
              renderSubHeader={renderSubHeader}
            />
          </View>
        ))}
      </WebCollapsiblePagerView>
    </AppPagerContext.Provider>
  );
}
