import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  ActionList,
  Divider,
  Icon,
  SizableText,
  SortableListView,
  Stack,
  XStack,
  useShortcuts,
} from '@onekeyhq/components';
import type {
  IActionListSection,
  ISortableListViewRef,
} from '@onekeyhq/components';
import type { IPageNavigationProp } from '@onekeyhq/components/src/layouts/Navigation';
import { useBrowserSubmenu } from '@onekeyhq/components/src/layouts/Navigation/Tab/TabBar/BrowserSubmenuColumn/BrowserSubmenuContext';
import { DesktopTabItem } from '@onekeyhq/components/src/layouts/Navigation/Tab/TabBar/DesktopTabItem';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import useListenTabFocusState from '@onekeyhq/kit/src/hooks/useListenTabFocusState';
import { usePrevious } from '@onekeyhq/kit/src/hooks/usePrevious';
import {
  useBrowserBookmarkAction,
  useBrowserTabActions,
} from '@onekeyhq/kit/src/states/jotai/contexts/discovery';
import { HandleRebuildBrowserData } from '@onekeyhq/kit/src/views/Discovery/components/HandleData/HandleRebuildBrowserTabData';
import type { IWebTab } from '@onekeyhq/kit/src/views/Discovery/types';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import type { INewBrowserTabPosition } from '@onekeyhq/kit-bg/src/states/jotai/atoms/settings';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { IDiscoveryModalParamList } from '@onekeyhq/shared/src/routes';
import {
  EDiscoveryModalRoutes,
  EModalRoutes,
  ETabRoutes,
} from '@onekeyhq/shared/src/routes';
import { EShortcutEvents } from '@onekeyhq/shared/src/shortcuts/shortcuts.enum';

import DesktopCustomTabBarItem from '../../components/DesktopCustomTabBarItem';
import { useDesktopNewWindow } from '../../hooks/useDesktopNewWindow';
import { useDiscoveryShortcuts } from '../../hooks/useShortcuts';
import { useActiveTabId, useWebTabs } from '../../hooks/useWebTabs';
import { withBrowserProvider } from '../Browser/WithBrowserProvider';

const TIMESTAMP_DIFF_MULTIPLIER = 2;

// Persist the last active tab ID across component mount/unmount cycles
// so that returning to MultiTabBrowser restores the previously viewed dApp.
let savedActiveTabId = '';

function DesktopCustomTabBar({ isExpanded }: { isExpanded?: boolean }) {
  const intl = useIntl();
  const isCollapsed = !(isExpanded ?? false);
  useDiscoveryShortcuts();
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
    setTabsByIds,
    addBrowserHomeTab,
    reOpenLastClosedTab,
  } = useBrowserTabActions().current;
  const { addOrUpdateBrowserBookmark, removeBrowserBookmark } =
    useBrowserBookmarkAction().current;

  const { reportPopoverOpen } = useBrowserSubmenu();
  // Guard against unbalanced onOpenChange calls from the ActionList.
  // Without this, a duplicate open / missing close would leak the popover
  // count in BrowserSubmenuColumn and the sidebar would never collapse again.
  const newTabMenuOpenRef = useRef(false);
  const handleNewTabMenuOpenChange = useCallback(
    (isOpen: boolean) => {
      if (isOpen && !newTabMenuOpenRef.current) {
        newTabMenuOpenRef.current = true;
        reportPopoverOpen(true);
      } else if (!isOpen && newTabMenuOpenRef.current) {
        newTabMenuOpenRef.current = false;
        reportPopoverOpen(false);
      }
    },
    [reportPopoverOpen],
  );
  useEffect(
    () => () => {
      if (newTabMenuOpenRef.current) {
        newTabMenuOpenRef.current = false;
        reportPopoverOpen(false);
      }
    },
    [reportPopoverOpen],
  );
  const [{ newBrowserTabPosition }] = useSettingsPersistAtom();
  const currentTabPosition = newBrowserTabPosition ?? 'bottom';
  const newTabPositionSections = useMemo<IActionListSection[]>(() => {
    const options = [
      {
        value: 'top' as INewBrowserTabPosition,
        labelId: 'global_top' as ETranslations,
        icon: 'ArrowTopOutline' as const,
      },
      {
        value: 'bottom' as INewBrowserTabPosition,
        labelId: 'global_bottom' as ETranslations,
        icon: 'ArrowBottomOutline' as const,
      },
    ];
    return [
      {
        title: intl.formatMessage({
          id: 'settings_browser_new_tab_position' as ETranslations,
        }),
        items: options.map(({ value, labelId, icon }) => ({
          label: intl.formatMessage({ id: labelId }),
          icon,
          extra:
            currentTabPosition === value ? (
              <Icon name="CheckRadioSolid" color="$iconActive" size="$5" />
            ) : null,
          onPress: () => {
            void backgroundApiProxy.serviceSetting.setNewBrowserTabPosition(
              value,
            );
          },
          testID: `browser-sidebar-new-tab-position-${value}`,
        })),
      },
    ];
  }, [currentTabPosition, intl]);

  const { pinnedTabs, unpinnedTabs } = useMemo(() => {
    const allTabs = tabs ?? [];
    return {
      pinnedTabs: allTabs.filter((t) => t.isPinned),
      unpinnedTabs: allTabs.filter((t) => !t.isPinned),
    };
  }, [tabs]);

  const scrollViewRef = useRef<ISortableListViewRef<any>>(null);
  const previousTabsLength = usePrevious(tabs?.length);
  useEffect(() => {
    if (previousTabsLength && tabs?.length > previousTabsLength) {
      if (unpinnedTabs.length > 0) {
        if (currentTabPosition === 'top') {
          scrollViewRef.current?.scrollToOffset({
            offset: 0,
            animated: true,
          });
        } else {
          scrollViewRef.current?.scrollToEnd({ animated: true });
        }
      }
    }
  }, [
    previousTabsLength,
    tabs?.length,
    unpinnedTabs.length,
    currentTabPosition,
  ]);

  const handlePinnedPress = useCallback(
    (id: string, pinned: boolean) => {
      void setPinnedTab({ id, pinned });
    },
    [setPinnedTab],
  );
  const handleCloseTab = useCallback(
    (id: string) => {
      void closeWebTab({
        tabId: id,
        entry: 'Menu',
        navigation,
      });
    },
    [closeWebTab, navigation],
  );
  const handleBookmarkPress = useCallback(
    (bookmark: boolean, url: string, title: string) => {
      if (bookmark) {
        void addOrUpdateBrowserBookmark({
          url,
          title,
          logo: undefined,
          sortIndex: undefined,
        });
      } else {
        void removeBrowserBookmark(url);
      }
    },
    [addOrUpdateBrowserBookmark, removeBrowserBookmark],
  );

  const handleDisconnect = useCallback(async (url: string | undefined) => {
    const { origin } = new URL(url ?? '');
    if (origin) {
      await backgroundApiProxy.serviceDApp.disconnectWebsite({
        origin,
        storageType: 'injectedProvider',
        entry: 'Browser',
      });
    }
  }, []);

  const [isDiscoveryFocused, setIsDiscoveryFocused] = useState(false);
  useListenTabFocusState(ETabRoutes.Discovery, setIsDiscoveryFocused);

  // Use a ref so the useListenTabFocusState callback (captured on mount)
  // always reads the current activeTabId value.
  const activeTabIdRef = useRef(activeTabId);
  activeTabIdRef.current = activeTabId;

  useListenTabFocusState(ETabRoutes.MultiTabBrowser, (isFocus: boolean) => {
    if (!isFocus) {
      // Save active tab before clearing so it can be restored when returning
      if (activeTabIdRef.current) {
        savedActiveTabId = activeTabIdRef.current;
      }
      setCurrentWebTab('');
    } else if (savedActiveTabId) {
      // Restore the previously active tab when MultiTabBrowser regains focus
      setCurrentWebTab(savedActiveTabId);
      savedActiveTabId = '';
    }
  });

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

  const onTabPress = useCallback(
    (id: string) => {
      // Clear saved tab so the restore callback won't overwrite this explicit selection
      savedActiveTabId = '';
      navigation.switchTab(ETabRoutes.MultiTabBrowser);
      setCurrentWebTab(id);
    },
    [setCurrentWebTab, navigation],
  );

  const handleShortcuts = useCallback(
    (eventName: EShortcutEvents) => {
      switch (eventName) {
        case EShortcutEvents.ReOpenLastClosedTab:
          if (reOpenLastClosedTab()) {
            savedActiveTabId = '';
            navigation.switchTab(ETabRoutes.MultiTabBrowser);
          }
          break;
        default:
          break;
      }
    },
    [navigation, reOpenLastClosedTab],
  );

  useShortcuts(undefined, handleShortcuts);

  const ITEM_HEIGHT = 36;

  const onPinnedDragEnd = useCallback(
    (dragResult: {
      data: IWebTab[];
      dragItem: IWebTab;
      prevItem: IWebTab | undefined;
      nextItem: IWebTab | undefined;
    }) => {
      const {
        data: reorderedPinned,
        dragItem,
        prevItem,
        nextItem,
      } = dragResult;
      reorderedPinned.forEach((item) => (item.isPinned = true));

      const beforeTimestamp = prevItem?.timestamp;
      const afterTimestamp = nextItem?.timestamp;
      if (!beforeTimestamp && afterTimestamp) {
        dragItem.timestamp = afterTimestamp - TIMESTAMP_DIFF_MULTIPLIER;
      } else if (!afterTimestamp && beforeTimestamp) {
        dragItem.timestamp = beforeTimestamp + TIMESTAMP_DIFF_MULTIPLIER;
      } else if (beforeTimestamp && afterTimestamp) {
        dragItem.timestamp = Math.round((beforeTimestamp + afterTimestamp) / 2);
      }

      setTimeout(() => {
        setTabsByIds({ pinnedTabs: reorderedPinned, unpinnedTabs });
      }, 0);
      defaultLogger.discovery.browser.tabDragSorting();
    },
    [setTabsByIds, unpinnedTabs],
  );

  const onDragEnd = useCallback(
    (dragResult: {
      data: IWebTab[];
      dragItem: IWebTab;
      prevItem: IWebTab | undefined;
      nextItem: IWebTab | undefined;
    }) => {
      const {
        data: reorderedUnpinned,
        dragItem,
        prevItem,
        nextItem,
      } = dragResult;
      reorderedUnpinned.forEach((item) => (item.isPinned = false));

      const beforeTimestamp = prevItem?.timestamp;
      const afterTimestamp = nextItem?.timestamp;
      if (!beforeTimestamp && afterTimestamp) {
        dragItem.timestamp = afterTimestamp - TIMESTAMP_DIFF_MULTIPLIER;
      } else if (!afterTimestamp && beforeTimestamp) {
        dragItem.timestamp = beforeTimestamp + TIMESTAMP_DIFF_MULTIPLIER;
      } else if (beforeTimestamp && afterTimestamp) {
        dragItem.timestamp = Math.round((beforeTimestamp + afterTimestamp) / 2);
      }

      setTimeout(() => {
        setTabsByIds({ pinnedTabs, unpinnedTabs: reorderedUnpinned });
      }, 0);
      defaultLogger.discovery.browser.tabDragSorting();
    },
    [setTabsByIds, pinnedTabs],
  );

  return (
    <Stack testID="sidebar-browser-section" flex={1}>
      <HandleRebuildBrowserData />
      {/* Fixed top area: buttons + pinned tabs + divider */}
      <Stack flexShrink={0}>
        <DesktopTabItem
          size="small"
          key="HomeButton"
          selected={isDiscoveryFocused}
          label={
            isCollapsed
              ? ''
              : intl.formatMessage({
                  id: ETranslations.global_home,
                })
          }
          icon="HomeDoor2Outline"
          testID="browser-bar-home"
          tabBarStyle={isCollapsed ? { justifyContent: 'center' } : undefined}
          onPress={(e) => {
            e.stopPropagation();
            navigation.switchTab(ETabRoutes.Discovery);
          }}
        />
        <DesktopTabItem
          size="small"
          key="AddTabButton"
          label={
            isCollapsed
              ? ''
              : intl.formatMessage({
                  id: ETranslations.explore_new_tab,
                })
          }
          icon="PlusSmallOutline"
          showTooltip={false}
          testID="browser-bar-add"
          tabBarStyle={isCollapsed ? { justifyContent: 'center' } : undefined}
          onPress={(e) => {
            e.stopPropagation();
            if (platformEnv.isDesktop) {
              savedActiveTabId = '';
              addBrowserHomeTab();
              navigation.switchTab(ETabRoutes.MultiTabBrowser);
            } else {
              navigation.pushModal(EModalRoutes.DiscoveryModal, {
                screen: EDiscoveryModalRoutes.SearchModal,
              });
            }
          }}
        />
        {pinnedTabs.length > 0 ? (
          <Stack height={pinnedTabs.length * ITEM_HEIGHT} overflow="hidden">
            <SortableListView
              data={pinnedTabs}
              scrollEnabled={false}
              renderItem={({
                item: t,
                dragProps,
              }: {
                item: IWebTab;
                dragProps?: Record<string, any>;
                index: number;
              }) => (
                <Stack dataSet={dragProps}>
                  <DesktopCustomTabBarItem
                    id={t.id}
                    key={t.id}
                    onPress={onTabPress}
                    isCollapse={isCollapsed}
                    onBookmarkPress={handleBookmarkPress}
                    onPinnedPress={handlePinnedPress}
                    onClose={handleCloseTab}
                    onDisconnect={handleDisconnect}
                    testID={`tab-list-stack-pinned-${t.id}`}
                  />
                </Stack>
              )}
              keyExtractor={(item) => item.id}
              getItemLayout={(__, index) => ({
                length: ITEM_HEIGHT,
                offset: ITEM_HEIGHT * index,
                index,
              })}
              onDragEnd={onPinnedDragEnd}
            />
          </Stack>
        ) : null}
        {unpinnedTabs.length > 0 ? (
          <XStack
            group="sidebarBrowserDivider"
            alignItems="center"
            px="$2"
            py="$2"
            width="100%"
          >
            <Divider testID="pin-tab-divider" width="$5" />
            {!isCollapsed ? (
              <XStack
                position="absolute"
                px="1"
                group="sidebarClearButton"
                alignItems="center"
                userSelect="none"
                right="$0"
                top="50%"
                bg="$bgApp"
                opacity={0}
                $group-sidebarBrowserDivider-hover={{
                  opacity: 1,
                }}
                style={{
                  containerType: 'normal',
                  transform: platformEnv.isNative ? '' : 'translateY(-50%)',
                }}
                onPress={() => {
                  void closeAllWebTabs({ navigation });
                }}
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
                  numberOfLines={1}
                  $group-sidebarClearButton-hover={{
                    color: '$text',
                  }}
                >
                  {intl.formatMessage({ id: ETranslations.global_clear })}
                </SizableText>
              </XStack>
            ) : null}
          </XStack>
        ) : null}
      </Stack>
      {/* Scrollable area: unpinned tabs */}
      <SortableListView
        ref={scrollViewRef}
        data={unpinnedTabs}
        renderItem={({
          item: t,
          dragProps,
        }: {
          item: IWebTab;
          dragProps?: Record<string, any>;
          index: number;
        }) => (
          <Stack dataSet={dragProps}>
            <DesktopCustomTabBarItem
              id={t.id}
              key={t.id}
              onPress={onTabPress}
              isCollapse={isCollapsed}
              onBookmarkPress={handleBookmarkPress}
              onPinnedPress={handlePinnedPress}
              onClose={handleCloseTab}
              onDisconnect={handleDisconnect}
              testID={`tab-list-stack-${t.id}`}
            />
          </Stack>
        )}
        keyExtractor={(item) => item.id}
        getItemLayout={(__, index) => ({
          length: ITEM_HEIGHT,
          offset: ITEM_HEIGHT * index,
          index,
        })}
        onDragEnd={onDragEnd}
        contentContainerStyle={{ pb: '$2' }}
      />
      {!isCollapsed ? (
        <XStack flexShrink={0} justifyContent="flex-end" px="$2" pb="$3">
          <ActionList
            title=""
            placement="top-end"
            sections={newTabPositionSections}
            onOpenChange={handleNewTabMenuOpenChange}
            renderTrigger={
              <Stack
                p="$1"
                borderRadius="$2"
                hoverStyle={{ bg: '$bgHover' }}
                pressStyle={{ bg: '$bgActive' }}
                cursor="default"
                testID="browser-sidebar-more"
                onPress={() => {}}
              >
                <Icon name="SettingsOutline" size="$5" color="$iconSubdued" />
              </Stack>
            }
          />
        </XStack>
      ) : null}
    </Stack>
  );
}

export default memo(withBrowserProvider(DesktopCustomTabBar));
