import type { Dispatch, SetStateAction } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { Progress, Stack, useBackHandler } from '@onekeyhq/components';
import WebView from '@onekeyhq/kit/src/components/WebView';
import {
  notifyTabNavigation,
  notifyTabNavigationEnd,
  tryDispatchTranslateMessage,
} from '@onekeyhq/kit/src/components/WebView/translateBridge';
import { handleDeepLinkUrl } from '@onekeyhq/kit/src/routes/config/deeplink';
import {
  homeTab,
  useBrowserAction,
  useBrowserTabActions,
} from '@onekeyhq/kit/src/states/jotai/contexts/discovery';
import { useSettingsFiatPaySiteWhitelistPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms/settings';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { handleOneKeyStoreLink } from '@onekeyhq/shared/src/utils/openUrlUtils';
import { EValidateUrlEnum } from '@onekeyhq/shared/types/dappConnection';

import {
  BITREFILL_BRIDGE_SCRIPT,
  isBitrefillEmbedUrl,
} from '../../utils/bitrefillUtils';
import { getWebviewWrapperRef, webviewRefs } from '../../utils/explorerUtils';
import {
  PAGE_THEME_COLOR_SCRIPT,
  applyCachedPageThemeColor,
  setPageThemeColor,
  tryDispatchPageThemeMessage,
} from '../../utils/pageThemeColor';
import { showTabBar } from '../../utils/tabBarUtils';
import BlockAccessView from '../BlockAccessView';

import type { IWebTab } from '../../types';
import type { IJsBridgeReceiveHandler } from '@onekeyfe/cross-inpage-provider-types';
import type {
  WebView as ReactNativeWebview,
  WebViewMessageEvent,
  WebViewNavigation,
  WebViewProps,
} from 'react-native-webview';
import type {
  ShouldStartLoadRequest,
  WebViewNavigationEvent,
} from 'react-native-webview/lib/WebViewTypes';

type IWebContentProps = IWebTab &
  WebViewProps & {
    isCurrent: boolean;
    setBackEnabled: Dispatch<SetStateAction<boolean>>;
    setForwardEnabled: Dispatch<SetStateAction<boolean>>;
    customReceiveHandler?: IJsBridgeReceiveHandler;
  };

// Best-effort script injection into a tab's WebView.
function injectScript(tabId: string, script: string) {
  try {
    (
      getWebviewWrapperRef(tabId)?.innerRef as ReactNativeWebview | undefined
    )?.injectJavaScript?.(script);
  } catch {
    // best-effort injection
  }
}

function WebContent({
  id,
  url,
  isCurrent,
  androidLayerType,
  canGoBack,
  setBackEnabled,
  setForwardEnabled,
  onScroll,
  siteMode,
  customReceiveHandler,
}: IWebContentProps) {
  const lastNavEventSnapshot = useRef('');
  const showHome = url === homeTab.url;
  const [progress, setProgress] = useState(5);
  const [showBlockAccessView, setShowBlockAccessView] = useState(false);
  const [urlValidateState, setUrlValidateState] = useState<EValidateUrlEnum>();
  const [blockedUrl, setBlockedUrl] = useState<string>();
  const [{ fiatPaySiteWhitelist }] =
    useSettingsFiatPaySiteWhitelistPersistAtom();
  const { onNavigation, gotoSite, validateWebviewSrc } =
    useBrowserAction().current;
  const { setWebTabData, closeWebTab, setCurrentWebTab } =
    useBrowserTabActions().current;

  const changeNavigationInfo = (siteInfo: WebViewNavigation) => {
    setBackEnabled(siteInfo.canGoBack);
    setForwardEnabled(siteInfo.canGoForward);
  };

  const onLoadStart = ({ nativeEvent }: WebViewNavigationEvent) => {
    notifyTabNavigation(id);
    applyCachedPageThemeColor(id, nativeEvent.url);

    if (
      nativeEvent.url !== url &&
      nativeEvent.loading &&
      nativeEvent.navigationType === 'backforward'
    ) {
      changeNavigationInfo({ ...nativeEvent });
    }
  };

  // Ask the page for its color (once per URL) so the browser chrome can tint
  // itself to match, like Safari.
  const lastThemeUrlRef = useRef('');
  const requestPageThemeColor = useCallback(
    (pageUrl: string) => {
      if (!pageUrl || pageUrl === lastThemeUrlRef.current) {
        return;
      }
      lastThemeUrlRef.current = pageUrl;
      injectScript(id, PAGE_THEME_COLOR_SCRIPT);
    },
    [id],
  );

  const onLoadEnd = ({ nativeEvent }: WebViewNavigationEvent) => {
    if (nativeEvent.loading) {
      return;
    }
    notifyTabNavigationEnd(id);
    changeNavigationInfo({ ...nativeEvent });
    requestPageThemeColor(nativeEvent.url);
    // Inject Bitrefill bridge for raw postMessage → JSBridge forwarding.
    if (isBitrefillEmbedUrl(nativeEvent.url)) {
      injectScript(id, BITREFILL_BRIDGE_SCRIPT);
    }
  };

  const onNavigationStateChange = useCallback(
    (navigationStateChangeEvent: WebViewNavigation) => {
      // if (showHome) {
      //   return;
      // }
      const snapshot = JSON.stringify(navigationStateChangeEvent);
      if (snapshot === lastNavEventSnapshot.current) {
        return;
      }
      lastNavEventSnapshot.current = snapshot;
      const {
        canGoBack: navCanGoBack,
        canGoForward,
        loading,
        title,
        url: navUrl,
      } = navigationStateChangeEvent;

      onNavigation({
        url: navUrl,
        title,
        canGoBack: navCanGoBack,
        canGoForward,
        loading,
        id,
      });
      // In-page (SPA) navigations don't fire onLoadEnd.
      if (!loading) {
        requestPageThemeColor(navUrl);
      }
    },
    [id, onNavigation, requestPageThemeColor],
  );

  const onShouldStartLoadWithRequest = useCallback(
    (navigationStateChangeEvent: ShouldStartLoadRequest) => {
      const { url: navUrl, isTopFrame } = navigationStateChangeEvent;
      const validateState = validateWebviewSrc({
        url: navUrl,
        isTopFrame,
      });
      if (validateState === EValidateUrlEnum.Valid) {
        return true;
      }
      if (validateState === EValidateUrlEnum.ValidDeeplink) {
        handleDeepLinkUrl({ url: navUrl });
        return false;
      }
      // iOS reports embedded frames; react-native-webview on Android always
      // reports the top frame.
      if (handleOneKeyStoreLink(navUrl, { isTopFrame })) {
        return false;
      }
      setShowBlockAccessView(true);
      setUrlValidateState(validateState);
      setBlockedUrl(navUrl);
      return false;
    },
    [validateWebviewSrc],
  );

  const handleMessage = useCallback(
    (event: WebViewMessageEvent) => {
      if (
        tryDispatchPageThemeMessage(
          id,
          event.nativeEvent.data,
          event.nativeEvent.url,
        )
      ) {
        return;
      }
      tryDispatchTranslateMessage(id, event.nativeEvent.data);
    },
    [id],
  );

  useBackHandler(
    useCallback(() => {
      if (isCurrent && webviewRefs[id] && canGoBack && id !== homeTab.id) {
        (webviewRefs[id]?.innerRef as ReactNativeWebview)?.goBack();
        return true;
      }
      return false;
    }, [canGoBack, id, isCurrent]),
  );

  // Release the WebView ref when this content unmounts. This fires both on tab
  // close and on keep-alive LRU eviction, so a stale ref never points at a
  // torn-down WebView (which pause/back-handler/bridge calls would touch).
  useEffect(
    () => () => {
      if (id !== homeTab.id) {
        delete webviewRefs[id];
      }
      setPageThemeColor(id, undefined);
    },
    [id],
  );

  const webview = useMemo(
    () => (
      <WebView
        key={url}
        siteMode={siteMode}
        androidLayerType={androidLayerType}
        pullToRefreshEnabled={!platformEnv.isNativeAndroid}
        src={url}
        mediaPermissionWhitelist={fiatPaySiteWhitelist}
        customReceiveHandler={customReceiveHandler}
        onWebViewRef={(ref) => {
          if (ref && ref.innerRef) {
            if (!webviewRefs[id]) {
              setWebTabData({
                id,
                refReady: true,
              });
            }
            if (id !== homeTab.id) {
              webviewRefs[id] = ref;
            }
          }
        }}
        onShouldStartLoadWithRequest={onShouldStartLoadWithRequest}
        onNavigationStateChange={onNavigationStateChange}
        onOpenWindow={(e) => {
          const { targetUrl } = e.nativeEvent;
          const validateState = validateWebviewSrc({
            url: targetUrl,
            isTopFrame: true,
          });
          if (validateState === EValidateUrlEnum.ValidDeeplink) {
            handleDeepLinkUrl({ url: targetUrl });
          } else if (!handleOneKeyStoreLink(targetUrl)) {
            void gotoSite({
              url: targetUrl,
              siteMode,
            });
          }
        }}
        allowpopups
        onMessage={handleMessage}
        onLoadStart={onLoadStart}
        // Read the page color as soon as the document is parsed (document
        // end), rather than waiting for onLoadEnd and every subresource.
        injectedJavaScript={PAGE_THEME_COLOR_SCRIPT}
        onLoadEnd={onLoadEnd as any}
        onScroll={onScroll}
        displayProgressBar={false}
        onProgress={(p) => setProgress(p)}
      />
    ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      androidLayerType,
      fiatPaySiteWhitelist,
      gotoSite,
      id,
      showHome,
      siteMode,
      url,
      customReceiveHandler,
    ],
  );

  const progressBar = useMemo(() => {
    if (progress < 100) {
      return (
        <Progress
          value={progress}
          width="100%"
          position="absolute"
          left={0}
          top={0}
          right={0}
          zIndex={10}
          borderRadius={0}
        />
      );
    }
    return null;
  }, [progress]);

  const blockAccessView = useMemo(
    () => (
      <Stack position="absolute" top={0} bottom={0} left={0} right={0}>
        <BlockAccessView
          url={blockedUrl}
          urlValidateState={urlValidateState}
          onCloseTab={() => {
            closeWebTab({ tabId: id, entry: 'BlockView' });
            setCurrentWebTab(null);
            showTabBar();
          }}
          // onContinue={() => {
          //   addUrlToPhishingCache({ url: phishingUrlRef.current });
          //   setShowPhishingView(false);
          //   onRefresh();
          // }}
        />
      </Stack>
    ),
    [blockedUrl, id, closeWebTab, setCurrentWebTab, urlValidateState],
  );

  return (
    <>
      {progressBar}
      {webview}
      {showBlockAccessView ? blockAccessView : null}
    </>
  );
}

export default WebContent;
