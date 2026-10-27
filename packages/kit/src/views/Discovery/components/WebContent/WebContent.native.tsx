import type { Dispatch, SetStateAction } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { Stack, useBackHandler } from '@onekeyhq/components';
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
  clearPageColors,
  documentUrlOf,
  isNewDocumentLoad,
  tryDispatchPageThemeMessage,
} from '../../utils/pageThemeColor';
import { showTabBar } from '../../utils/tabBarUtils';
import BlockAccessView from '../BlockAccessView';
import { PAGE_DRAWS_UNDER_BROWSER_BAR } from '../MobileBrowser/browserChrome';

import BrowserLoadingBar from './BrowserLoadingBar';

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

  // Ask the page for its color (once per URL) so the browser chrome can tint
  // itself to match, like Safari.
  const lastThemeUrlRef = useRef('');
  // The document last loaded here, ignoring its hash: a different document is
  // what makes the bottom color stale (see applyCachedPageThemeColor).
  const lastDocumentUrlRef = useRef('');

  const onLoadStart = ({ nativeEvent }: WebViewNavigationEvent) => {
    notifyTabNavigation(id);
    // A hash change, or Android's same-document history update, reloads
    // nothing: the document keeps its colors.
    const isNewDocument = isNewDocumentLoad({
      url: nativeEvent.url ?? '',
      previousDocumentUrl: lastDocumentUrlRef.current,
      loading: nativeEvent.loading,
      isAndroid: !!platformEnv.isNativeAndroid,
    });
    lastDocumentUrlRef.current = documentUrlOf(nativeEvent.url ?? '');
    applyCachedPageThemeColor(id, nativeEvent.url, isNewDocument);
    // A full load runs the theme script itself (injectedJavaScript); only
    // SPA navigations need it injected again.
    lastThemeUrlRef.current = nativeEvent.url;

    if (
      nativeEvent.url !== url &&
      nativeEvent.loading &&
      nativeEvent.navigationType === 'backforward'
    ) {
      changeNavigationInfo({ ...nativeEvent });
    }
  };

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
      clearPageColors(id);
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
        scrollViewClipsToBounds={!PAGE_DRAWS_UNDER_BROWSER_BAR}
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
      <BrowserLoadingBar progress={progress} />
      {webview}
      {showBlockAccessView ? blockAccessView : null}
    </>
  );
}

export default WebContent;
