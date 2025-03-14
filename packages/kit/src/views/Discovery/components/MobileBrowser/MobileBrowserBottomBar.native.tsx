import { useCallback, useEffect, useMemo } from 'react';

import { manipulateAsync } from 'expo-image-manipulator';
import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';
import { captureRef } from 'react-native-view-shot';

import type { IStackProps } from '@onekeyhq/components';
import {
  IconButton,
  SizableText,
  Stack,
  Toast,
  useClipboard,
} from '@onekeyhq/components';
import type { IPageNavigationProp } from '@onekeyhq/components/src/layouts/Navigation';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import {
  useBrowserBookmarkAction,
  useBrowserTabActions,
} from '@onekeyhq/kit/src/states/jotai/contexts/discovery';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IDiscoveryModalParamList } from '@onekeyhq/shared/src/routes';
import {
  EDiscoveryModalRoutes,
  EModalRoutes,
} from '@onekeyhq/shared/src/routes';
import { openUrlExternal } from '@onekeyhq/shared/src/utils/openUrlUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';

import { BROWSER_BOTTOM_BAR_HEIGHT } from '../../config/Animation.constants';
import { THUMB_CROP_SIZE } from '../../config/TabList.constants';
import useBrowserOptionsAction from '../../hooks/useBrowserOptionsAction';
import {
  useDisabledAddedNewTab,
  useDisplayHomePageFlag,
  useWebTabDataById,
  useWebTabs,
} from '../../hooks/useWebTabs';
import { captureViewRefs, webviewRefs } from '../../utils/explorerUtils';
import { getScreenshotPath, saveScreenshot } from '../../utils/screenshot';
import { showTabBar } from '../../utils/tabBarUtils';

import MobileBrowserBottomOptions from './MobileBrowserBottomOptions';

import type { ESiteMode } from '../../types';
import type WebView from 'react-native-webview';

export interface IMobileBrowserBottomBarProps extends IStackProps {
  id: string;
  onGoBackHomePage?: () => void;
}

export const useTakeScreenshot = (id?: string | null) => {
  const actionsRef = useBrowserTabActions();
  const takeScreenshot = useCallback(
    () =>
      new Promise<boolean>((resolve, reject) => {
        if (!id) {
          reject(new Error('capture view id is null'));
          return;
        }
        captureRef(captureViewRefs[id ?? ''], {
          format: 'jpg',
          quality: 0.2,
        })
          .then(async (imageUri) => {
            const manipulateValue = await manipulateAsync(imageUri, [
              {
                crop: {
                  originX: 0,
                  originY: 0,
                  width: THUMB_CROP_SIZE,
                  height: THUMB_CROP_SIZE,
                },
              },
            ]);
            const path = getScreenshotPath(`${id}-${Date.now()}.jpg`);
            actionsRef.current.setWebTabData({
              id,
              thumbnail: path,
            });
            void saveScreenshot(manipulateValue.uri, path);
            resolve(true);
          })
          .catch((e) => {
            console.log('capture error e: ', e);
            reject(e);
          });
      }),
    [actionsRef, id],
  );

  return takeScreenshot;
};

function MobileBrowserBottomBar({
  id,
  onGoBackHomePage,
  ...rest
}: IMobileBrowserBottomBarProps) {
  const intl = useIntl();
  const navigation =
    useAppNavigation<IPageNavigationProp<IDiscoveryModalParamList>>();

  const { tab } = useWebTabDataById(id);
  const { tabs } = useWebTabs();

  useEffect(() => {
    if (tab?.url) {
      console.log('tab.url: ===>: ', tab.url);
    }
  }, [tab?.url]);

  const origin = tab?.url ? new URL(tab.url).origin : null;
  const { result: hasConnectedAccount, run: refreshConnectState } =
    usePromiseResult(async () => {
      try {
        if (!origin) {
          return false;
        }
        const connectedAccount =
          await backgroundApiProxy.serviceDApp.findInjectedAccountByOrigin(
            origin,
          );
        return (connectedAccount ?? []).length > 0;
      } catch {
        return false;
      }
    }, [origin]);

  const { displayHomePage } = useDisplayHomePageFlag();
  const { setPinnedTab, setCurrentWebTab, closeWebTab, setSiteMode } =
    useBrowserTabActions().current;
  const { disabledAddedNewTab } = useDisabledAddedNewTab();
  const { addBrowserBookmark, removeBrowserBookmark } =
    useBrowserBookmarkAction().current;
  const { handleShareUrl } = useBrowserOptionsAction();

  const tabCount = useMemo(() => tabs.length, [tabs]);

  const takeScreenshot = useTakeScreenshot(id);

  const handleShowTabList = useCallback(async () => {
    try {
      if (!displayHomePage) {
        await takeScreenshot();
      }
    } catch (e) {
      console.error(e);
    }
    navigation.pushModal(EModalRoutes.DiscoveryModal, {
      screen: EDiscoveryModalRoutes.MobileTabList,
    });
  }, [takeScreenshot, navigation, displayHomePage]);

  const handleAddNewTab = useCallback(async () => {
    if (disabledAddedNewTab) {
      Toast.message({
        title: intl.formatMessage(
          { id: ETranslations.explore_toast_tab_limit_reached },
          { number: '20' },
        ),
      });
      return;
    }
    try {
      if (!displayHomePage) {
        await takeScreenshot();
      }
    } catch (e) {
      console.error(e);
    }
    navigation.pushModal(EModalRoutes.DiscoveryModal, {
      screen: EDiscoveryModalRoutes.SearchModal,
    });
  }, [disabledAddedNewTab, navigation, displayHomePage, takeScreenshot, intl]);

  const handleBookmarkPress = useCallback(
    (isBookmark: boolean) => {
      if (tab) {
        if (isBookmark) {
          void addBrowserBookmark({ url: tab?.url, title: tab?.title ?? '' });
        } else {
          void removeBrowserBookmark(tab?.url);
        }
      }
      Toast.success({
        title: isBookmark
          ? intl.formatMessage({
              id: ETranslations.explore_toast_bookmark_added,
            })
          : intl.formatMessage({
              id: ETranslations.explore_toast_bookmark_removed,
            }),
      });
    },
    [tab, intl, addBrowserBookmark, removeBrowserBookmark],
  );

  const handlePinTab = useCallback(
    (pinned: boolean) => {
      setPinnedTab({ id, pinned });
      Toast.success({
        title: pinned
          ? intl.formatMessage({ id: ETranslations.explore_toast_pinned })
          : intl.formatMessage({ id: ETranslations.explore_toast_unpinned }),
      });
    },
    [setPinnedTab, id, intl],
  );

  const handleCloseTab = useCallback(async () => {
    // a workaround to fix this issue
    //  that remove page includes Popover from screen before closing popover
    setTimeout(() => {
      closeWebTab({ tabId: id, entry: 'Menu' });
      setCurrentWebTab(null);
    });

    showTabBar();
  }, [closeWebTab, setCurrentWebTab, id]);

  const onShare = useCallback(() => {
    handleShareUrl(tab?.url ?? '');
  }, [tab?.url, handleShareUrl]);

  const { copyText } = useClipboard();
  const onCopyUrl = useCallback(() => {
    if (tab?.url) {
      copyText(tab.url);
    }
  }, [tab?.url, copyText]);

  useEffect(() => {
    const fn = () => {
      setTimeout(() => {
        void refreshConnectState();
      }, 200);
    };
    appEventBus.on(EAppEventBusNames.DAppConnectUpdate, fn);
    return () => {
      appEventBus.off(EAppEventBusNames.DAppConnectUpdate, fn);
    };
  }, [refreshConnectState]);
  const handleDisconnect = useCallback(async () => {
    if (!origin) return;
    await backgroundApiProxy.serviceDApp.disconnectWebsite({
      origin,
      storageType: 'injectedProvider',
      entry: 'Browser',
    });
    void refreshConnectState();
  }, [origin, refreshConnectState]);

  const handleRefresh = useCallback(() => {
    webviewRefs[id]?.reload();
  }, [id]);

  const handleRequestSiteMode = useCallback(
    async (siteMode: ESiteMode) => {
      setSiteMode({ id, siteMode });
      await timerUtils.wait(150);
      handleRefresh();
    },
    [handleRefresh, id, setSiteMode],
  );

  const disabledGoBack = displayHomePage || !tab?.canGoBack;
  const disabledGoForward = displayHomePage ? true : !tab?.canGoForward;
  return (
    <Stack
      flexDirection="row"
      bg="$bgApp"
      h={BROWSER_BOTTOM_BAR_HEIGHT}
      zIndex={1}
      borderTopWidth={StyleSheet.hairlineWidth}
      borderTopColor="$borderSubdued"
      {...rest}
    >
      <Stack flex={1} alignItems="center" justifyContent="center">
        <IconButton
          variant="tertiary"
          size="medium"
          icon="ChevronLeftOutline"
          disabled={disabledGoBack}
          accessible={!disabledGoBack}
          onPress={() => {
            (webviewRefs[id]?.innerRef as WebView)?.goBack();
          }}
          testID="browser-bar-go-back"
        />
      </Stack>
      <Stack flex={1} alignItems="center" justifyContent="center">
        <IconButton
          variant="tertiary"
          size="medium"
          icon="ChevronRightOutline"
          disabled={disabledGoForward}
          accessible={!disabledGoForward}
          onPress={() => {
            (webviewRefs[id]?.innerRef as WebView)?.goForward();
          }}
          testID="browser-bar-go-forward"
        />
      </Stack>
      <Stack flex={1} alignItems="center" justifyContent="center">
        <IconButton
          variant="secondary"
          size="medium"
          icon="PlusLargeOutline"
          onPress={handleAddNewTab}
          testID="browser-bar-add"
        />
      </Stack>
      <Stack flex={1} alignItems="center" justifyContent="center">
        <Stack
          p="$3"
          borderRadius="$full"
          pressStyle={{
            bg: '$bgActive',
          }}
          onPress={() => {
            void handleShowTabList();
          }}
          testID="browser-bar-tabs"
        >
          <Stack
            minWidth="$5"
            minHeight="$5"
            borderRadius="$1"
            borderWidth="$0.5"
            borderColor="$iconSubdued"
            alignItems="center"
            justifyContent="center"
          >
            <SizableText size="$bodySmMedium" color="$iconSubdued">
              {tabCount}
            </SizableText>
          </Stack>
        </Stack>
      </Stack>
      <Stack flex={1} alignItems="center" justifyContent="center">
        <MobileBrowserBottomOptions
          disabled={displayHomePage}
          isBookmark={tab?.isBookmark ?? false}
          onBookmarkPress={handleBookmarkPress}
          onRefresh={handleRefresh}
          onShare={onShare}
          onCopyUrl={onCopyUrl}
          isPinned={tab?.isPinned ?? false}
          onPinnedPress={handlePinTab}
          onBrowserOpen={() => {
            if (tab?.url) {
              openUrlExternal(tab.url);
            }
          }}
          onGoBackHomePage={onGoBackHomePage}
          onCloseTab={handleCloseTab}
          displayDisconnectOption={!!hasConnectedAccount}
          onDisconnect={handleDisconnect}
          siteMode={tab?.siteMode}
          onRequestSiteMode={handleRequestSiteMode}
        >
          <IconButton
            variant="tertiary"
            size="medium"
            icon="DotHorOutline"
            disabled={displayHomePage}
            testID="browser-bar-options"
          />
        </MobileBrowserBottomOptions>
      </Stack>
    </Stack>
  );
}

export default MobileBrowserBottomBar;
