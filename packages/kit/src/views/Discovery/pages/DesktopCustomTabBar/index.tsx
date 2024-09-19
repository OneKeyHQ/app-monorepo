import { memo, useCallback, useEffect, useMemo, useRef } from 'react';

import { useIntl } from 'react-intl';

import {
  Divider,
  Icon,
  SizableText,
  SortableSectionList,
  Stack,
  XStack,
} from '@onekeyhq/components';
import type { ISortableSectionListRef } from '@onekeyhq/components';
import type { IPageNavigationProp } from '@onekeyhq/components/src/layouts/Navigation';
import { DesktopTabItem } from '@onekeyhq/components/src/layouts/Navigation/Tab/TabBar/DesktopTabItem';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import useListenTabFocusState from '@onekeyhq/kit/src/hooks/useListenTabFocusState';
import { usePrevious } from '@onekeyhq/kit/src/hooks/usePrevious';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import {
  useBrowserBookmarkAction,
  useBrowserTabActions,
} from '@onekeyhq/kit/src/states/jotai/contexts/discovery';
import { HandleRebuildBrowserData } from '@onekeyhq/kit/src/views/Discovery/components/HandleData/HandleRebuildBrowserTabData';
import type { IWebTab } from '@onekeyhq/kit/src/views/Discovery/types';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { IDiscoveryModalParamList } from '@onekeyhq/shared/src/routes';
import {
  EDiscoveryModalRoutes,
  EModalRoutes,
  ETabRoutes,
} from '@onekeyhq/shared/src/routes';

import DesktopCustomTabBarItem from '../../components/DesktopCustomTabBarItem';
import { useDesktopNewWindow } from '../../hooks/useDesktopNewWindow';
import { useShortcuts } from '../../hooks/useShortcuts';
import { useActiveTabId, useWebTabs } from '../../hooks/useWebTabs';
import { withBrowserProvider } from '../Browser/WithBrowserProvider';

const ITEM_HEIGHT = 32;
function DesktopCustomTabBar() {
  const intl = useIntl();
  // register desktop shortcuts for browser tab
  useShortcuts();
  // register desktop new window event
  useDesktopNewWindow();

  const navigation =
    useAppNavigation<IPageNavigationProp<IDiscoveryModalParamList>>();
  const { tabs } = useWebTabs();
  const { activeTabId } = useActiveTabId();
  const {
    setCurrentWebTab,
    closeWebTab,
    setPinnedTab,
    closeAllWebTabs,
    setTabs,
  } = useBrowserTabActions().current;
  const { addBrowserBookmark, removeBrowserBookmark } =
    useBrowserBookmarkAction().current;

  const { result, setResult, run } = usePromiseResult(async () => {
    const tabsWithConnectedAccount = await Promise.all(
      (tabs ?? []).map(async (tab) => {
        const origin = tab?.url ? new URL(tab.url).origin : null;
        let hasConnectedAccount = false;
        if (origin) {
          const connectedAccounts =
            await backgroundApiProxy.serviceDApp.findInjectedAccountByOrigin(
              origin,
            );
          hasConnectedAccount = (connectedAccounts ?? []).length > 0;
        }
        return { ...tab, hasConnectedAccount };
      }),
    );
    const unpinnedTabs = (tabsWithConnectedAccount ?? []).filter(
      (t) => !t.isPinned,
    );
    unpinnedTabs.reverse();
    const pinnedTabs = (tabsWithConnectedAccount ?? []).filter(
      (t) => t.isPinned,
    );
    return {
      unpinnedTabs,
      pinnedTabs,
    };
  }, [tabs]);

  const scrollViewRef = useRef<ISortableSectionListRef<any>>(null);
  const previousTabsLength = usePrevious(tabs?.length);
  useEffect(() => {
    if (previousTabsLength && tabs?.length > previousTabsLength) {
      scrollViewRef.current?.scrollToLocation({
        sectionIndex: 0,
        itemIndex: result?.pinnedTabs?.length ?? 0,
        animated: true,
      });
    }
  }, [previousTabsLength, tabs?.length, result?.pinnedTabs]);

  const handlePinnedPress = useCallback(
    (id: string, pinned: boolean) => {
      void setPinnedTab({ id, pinned });
    },
    [setPinnedTab],
  );
  const handleCloseTab = useCallback(
    (id: string) => {
      void closeWebTab(id);
    },
    [closeWebTab],
  );
  const handleBookmarkPress = useCallback(
    (bookmark: boolean, url: string, title: string) => {
      if (bookmark) {
        void addBrowserBookmark({ url, title });
      } else {
        void removeBrowserBookmark(url);
      }
    },
    [addBrowserBookmark, removeBrowserBookmark],
  );

  const handleDisconnect = useCallback(
    async (url: string | undefined) => {
      const { origin } = new URL(url ?? '');
      if (origin) {
        await backgroundApiProxy.serviceDApp.disconnectWebsite({
          origin,
          storageType: 'injectedProvider',
        });
        setTimeout(() => run(), 200);
      }
    },
    [run],
  );

  useListenTabFocusState(ETabRoutes.MultiTabBrowser, (isFocus: boolean) => {
    if (!isFocus) {
      setCurrentWebTab('');
    }
  });

  useEffect(() => {
    const listener = () => {
      closeAllWebTabs();
    };
    appEventBus.on(EAppEventBusNames.CloseAllBrowserTab, listener);
    return () => {
      appEventBus.off(EAppEventBusNames.CloseAllBrowserTab, listener);
    };
  }, [closeAllWebTabs]);

  // For risk detection
  useEffect(() => {
    const listener = () => {
      if (activeTabId) {
        handleCloseTab(activeTabId);
      }
    };
    appEventBus.on(EAppEventBusNames.CloseCurrentBrowserTab, listener);
    return () => {
      appEventBus.off(EAppEventBusNames.CloseCurrentBrowserTab, listener);
    };
  }, [handleCloseTab, activeTabId]);

  // For dApp connection state update
  useEffect(() => {
    const fn = () => setTimeout(() => run(), 200);
    appEventBus.on(EAppEventBusNames.DAppConnectUpdate, fn);
    return () => {
      appEventBus.off(EAppEventBusNames.DAppConnectUpdate, fn);
    };
  }, [run]);

  const onTabPress = useCallback(
    (id: string) => {
      navigation.switchTab(ETabRoutes.MultiTabBrowser);
      setCurrentWebTab(id);
    },
    [setCurrentWebTab, navigation],
  );

  const sections = useMemo(
    () => [{ data: result?.pinnedTabs }, { data: result?.unpinnedTabs }],
    [result?.pinnedTabs, result?.unpinnedTabs],
  );
  const layoutList = useMemo(() => {
    let offset = 0;
    const layouts: { offset: number; length: number; index: number }[] = [];
    layouts.push({ offset, length: 0, index: layouts.length });
    sections?.[0]?.data?.forEach(() => {
      layouts.push({ offset, length: ITEM_HEIGHT, index: layouts.length });
      offset += ITEM_HEIGHT;
    });
    layouts.push({ offset, length: 0, index: layouts.length });
    layouts.push({ offset, length: 0, index: layouts.length });
    layouts.push({ offset, length: 17 + ITEM_HEIGHT, index: layouts.length });
    offset += 17 + ITEM_HEIGHT;
    sections?.[1]?.data?.forEach(() => {
      layouts.push({ offset, length: ITEM_HEIGHT, index: layouts.length });
      offset += ITEM_HEIGHT;
    });
    layouts.push({ offset, length: 0, index: layouts.length });
    offset += 0;
    return layouts;
  }, [sections]);
  const onDragEnd = useCallback(
    (dragResult: {
      sections: {
        data?: any[];
      }[];
      from?: {
        sectionIndex: number;
        itemIndex: number;
      };
    }) => {
      const pinnedTabs = (dragResult?.sections?.[0]?.data ?? []) as (IWebTab & {
        hasConnectedAccount: boolean;
      })[];
      const unpinnedTabs = (dragResult?.sections?.[1]?.data ??
        []) as (IWebTab & {
        hasConnectedAccount: boolean;
      })[];
      pinnedTabs?.forEach?.((item) => (item.isPinned = true));
      unpinnedTabs?.forEach?.((item) => (item.isPinned = false));
      const reloadTimeStamp = () => {
        if (!dragResult?.from) {
          return;
        }
        const fromItem =
          sections?.[dragResult?.from?.sectionIndex]?.data?.[
            dragResult?.from?.itemIndex
          ];
        let fromItemIndex: number | undefined;
        let fromSectionData: IWebTab[] | undefined;
        dragResult?.sections?.forEach((section) => {
          section?.data?.forEach((item, index) => {
            if (item === fromItem) {
              fromItemIndex = index;
              fromSectionData = section?.data;
            }
          });
        });

        if (
          !fromSectionData ||
          fromSectionData.length === 1 ||
          !fromItem ||
          fromItemIndex === undefined
        ) {
          return;
        }

        const beforeTimestamp =
          fromItemIndex === 0
            ? undefined
            : fromSectionData?.[fromItemIndex - 1]?.timestamp;
        const afterTimestamp =
          fromItemIndex === fromSectionData.length - 1
            ? undefined
            : fromSectionData?.[fromItemIndex + 1]?.timestamp;
        const isPinnedDiff = fromItem.isPinned ? 1 : -1;
        if (!beforeTimestamp && afterTimestamp) {
          fromItem.timestamp = afterTimestamp + isPinnedDiff * -2;
        } else if (!afterTimestamp && beforeTimestamp) {
          fromItem.timestamp = beforeTimestamp + isPinnedDiff * 2;
        } else if (beforeTimestamp && afterTimestamp) {
          fromItem.timestamp = Math.round(
            (beforeTimestamp + afterTimestamp) / 2,
          );
        }
      };
      reloadTimeStamp();
      setResult({ pinnedTabs, unpinnedTabs });
      setTabs([...pinnedTabs, ...unpinnedTabs]);
    },
    [setTabs, setResult, sections],
  );

  return (
    <Stack testID="sideabr-browser-section" flex={1}>
      <HandleRebuildBrowserData />
      <SortableSectionList
        ref={scrollViewRef}
        sections={sections}
        renderItem={({
          item: t,
          dragProps,
        }: {
          item: IWebTab & { hasConnectedAccount: boolean };
          dragProps?: Record<string, any>;
        }) => (
          <Stack dataSet={dragProps}>
            <DesktopCustomTabBarItem
              id={t.id}
              key={t.id}
              activeTabId={activeTabId}
              onPress={onTabPress}
              onBookmarkPress={handleBookmarkPress}
              onPinnedPress={handlePinnedPress}
              onClose={handleCloseTab}
              displayDisconnectOption={t.hasConnectedAccount}
              onDisconnect={handleDisconnect}
              testID={`tab-list-stack-pinned-${t.id}`}
            />
          </Stack>
        )}
        keyExtractor={(item) => `${(item as { id: number }).id}`}
        getItemLayout={(__, index) => layoutList[index]}
        stickySectionHeadersEnabled={false}
        SectionSeparatorComponent={null}
        onDragEnd={onDragEnd}
        allowCrossSection
        renderSectionHeader={({ index }) =>
          index === 1 ? (
            <>
              <XStack group="sidebarBrowserDivider" alignItems="center" p="$2">
                <Divider testID="pin-tab-divider" />
                {tabs.filter((x) => !x.isPinned).length > 0 ? (
                  <XStack
                    position="absolute"
                    px="1"
                    group="sidebarClearButton"
                    alignItems="center"
                    userSelect="none"
                    right="$0"
                    top="50%"
                    bg="$bgSidebar"
                    opacity={0}
                    $group-sidebarBrowserDivider-hover={{
                      opacity: 1,
                    }}
                    style={{
                      containerType: 'normal',
                      transform: platformEnv.isNative ? '' : 'translateY(-50%)',
                    }}
                    onPress={closeAllWebTabs}
                  >
                    <Icon
                      flexShrink={0}
                      color="$iconSubdued"
                      name="ArrowBottomOutline"
                      size="$3"
                    />
                    <SizableText
                      pl="$1"
                      color="$textSubdued"
                      size="$bodySmMedium"
                      $group-sidebarClearButton-hover={{
                        color: '$text',
                      }}
                    >
                      {intl.formatMessage({ id: ETranslations.global_clear })}
                    </SizableText>
                  </XStack>
                ) : null}
              </XStack>
              <DesktopTabItem
                key="AddTabButton"
                label={intl.formatMessage({
                  id: ETranslations.explore_new_tab,
                })}
                icon="PlusSmallOutline"
                testID="browser-bar-add"
                onPress={(e) => {
                  e.stopPropagation();
                  navigation.pushModal(EModalRoutes.DiscoveryModal, {
                    screen: EDiscoveryModalRoutes.SearchModal,
                  });
                }}
              />
            </>
          ) : null
        }
      />
    </Stack>
  );
}

export default memo(withBrowserProvider(DesktopCustomTabBar));
