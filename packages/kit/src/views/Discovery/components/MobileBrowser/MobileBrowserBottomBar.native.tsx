import { useCallback, useEffect } from 'react';

import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';

import type { IStackProps } from '@onekeyhq/components';
import { IconButton, Stack, Toast, useClipboard } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
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
import { openUrlExternal } from '@onekeyhq/shared/src/utils/openUrlUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';

import { BROWSER_BOTTOM_BAR_HEIGHT } from '../../config/Animation.constants';
import useBrowserOptionsAction from '../../hooks/useBrowserOptionsAction';
import {
  useDisplayHomePageFlag,
  useWebTabDataById,
} from '../../hooks/useWebTabs';
import { webviewRefs } from '../../utils/explorerUtils';
import { showTabBar } from '../../utils/tabBarUtils';

import MobileBrowserBottomOptions from './MobileBrowserBottomOptions';
import RefreshButton from './RefreshButton';
import TabCountButton from './TabCountButton';

import type { ESiteMode } from '../../types';
import type WebView from 'react-native-webview';

export interface IMobileBrowserBottomBarProps extends IStackProps {
  id: string;
  onGoBackHomePage?: () => void;
}

function MobileBrowserBottomBar({
  id,
  onGoBackHomePage,
  ...rest
}: IMobileBrowserBottomBarProps) {
  const intl = useIntl();

  const { tab } = useWebTabDataById(id);

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

  const {
    addOrUpdateBrowserBookmark: addBrowserBookmark,
    removeBrowserBookmark,
  } = useBrowserBookmarkAction().current;
  const { handleShareUrl } = useBrowserOptionsAction();

  const handleBookmarkPress = useCallback(
    (isBookmark: boolean) => {
      if (tab) {
        if (isBookmark) {
          void addBrowserBookmark({
            url: tab?.url,
            title: tab?.title ?? '',
            logo: undefined,
            sortIndex: undefined,
          });
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
    handleShareUrl(tab?.displayUrl ?? tab?.url ?? '');
  }, [tab?.displayUrl, tab?.url, handleShareUrl]);

  const { copyText } = useClipboard();
  const onCopyUrl = useCallback(() => {
    const urlToCopy = tab?.displayUrl ?? tab?.url;
    if (urlToCopy) {
      copyText(urlToCopy);
    }
  }, [tab?.displayUrl, tab?.url, copyText]);

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
        <TabCountButton testID="browser-bar-tabs" />
      </Stack>

      <Stack flex={1} alignItems="center" justifyContent="center">
        <RefreshButton onRefresh={handleRefresh} />
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
            const urlToOpen = tab?.displayUrl ?? tab?.url;
            if (urlToOpen) {
              openUrlExternal(urlToOpen);
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
