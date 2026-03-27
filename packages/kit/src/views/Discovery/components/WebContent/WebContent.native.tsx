import type { Dispatch, SetStateAction } from 'react';
import { useCallback, useMemo, useRef, useState } from 'react';

import { Dialog, Progress, Stack, useBackHandler } from '@onekeyhq/components';
import WebView from '@onekeyhq/kit/src/components/WebView';
import { handleDeepLinkUrl } from '@onekeyhq/kit/src/routes/config/deeplink';
import {
  homeTab,
  useBrowserAction,
  useBrowserTabActions,
} from '@onekeyhq/kit/src/states/jotai/contexts/discovery';
import { useSettingsFiatPaySiteWhitelistPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms/settings';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { EValidateUrlEnum } from '@onekeyhq/shared/types/dappConnection';

import { webviewRefs } from '../../utils/explorerUtils';
import { showTabBar } from '../../utils/tabBarUtils';
import BlockAccessView from '../BlockAccessView';

import type { IWebTab } from '../../types';
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

// Injected before page content loads; intercepts getUserMedia calls and
// notifies React Native so we can show a permission confirmation dialog.
const MEDIA_PERMISSION_INTERCEPT_JS = `
(function() {
  if (!window.navigator || !window.navigator.mediaDevices) return;
  var _orig = window.navigator.mediaDevices.getUserMedia.bind(window.navigator.mediaDevices);
  window.navigator.mediaDevices.getUserMedia = function(constraints) {
    if (window.ReactNativeWebView) {
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'ONEKEY_MEDIA_PERMISSION_REQUEST',
        origin: window.location.origin,
      }));
    }
    return _orig(constraints);
  };
})();
true;
`;

type IWebContentProps = IWebTab &
  WebViewProps & {
    isCurrent: boolean;
    setBackEnabled: Dispatch<SetStateAction<boolean>>;
    setForwardEnabled: Dispatch<SetStateAction<boolean>>;
  };

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
}: IWebContentProps) {
  const lastNavEventSnapshot = useRef('');
  const showHome = url === homeTab.url;
  const [progress, setProgress] = useState(5);
  const [showBlockAccessView, setShowBlockAccessView] = useState(false);
  const [urlValidateState, setUrlValidateState] = useState<EValidateUrlEnum>();
  const [grantedOrigins, setGrantedOrigins] = useState<string[]>([]);
  const [{ fiatPaySiteWhitelist }] =
    useSettingsFiatPaySiteWhitelistPersistAtom();
  const { onNavigation, gotoSite, validateWebviewSrc } =
    useBrowserAction().current;
  const { setWebTabData, closeWebTab, setCurrentWebTab } =
    useBrowserTabActions().current;

  const onMessage = useCallback(
    (event: WebViewMessageEvent) => {
      try {
        const data = JSON.parse(event.nativeEvent.data) as {
          type: string;
          origin: string;
        };
        if (data.type === 'ONEKEY_MEDIA_PERMISSION_REQUEST' && data.origin) {
          const { origin } = data;
          if (
            fiatPaySiteWhitelist.includes(origin) ||
            grantedOrigins.includes(origin)
          ) {
            return;
          }
          Dialog.confirm({
            title: 'Camera / Microphone Access',
            description: `Allow "${origin}" to access your camera and microphone?`,
            onConfirm: () => {
              setGrantedOrigins((prev) => [...prev, origin]);
            },
          });
        }
      } catch {
        // ignore non-JSON messages from the page
      }
    },
    [fiatPaySiteWhitelist, grantedOrigins],
  );

  const changeNavigationInfo = (siteInfo: WebViewNavigation) => {
    setBackEnabled(siteInfo.canGoBack);
    setForwardEnabled(siteInfo.canGoForward);
  };

  const onLoadStart = ({ nativeEvent }: WebViewNavigationEvent) => {
    // const { hostname } = new URL(nativeEvent.url);

    if (
      nativeEvent.url !== url &&
      nativeEvent.loading &&
      nativeEvent.navigationType === 'backforward'
    ) {
      changeNavigationInfo({ ...nativeEvent });
    }
  };

  const onLoadEnd = ({ nativeEvent }: WebViewNavigationEvent) => {
    if (nativeEvent.loading) {
      return;
    }
    changeNavigationInfo({ ...nativeEvent });
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
    },
    [id, onNavigation],
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
      setShowBlockAccessView(true);
      setUrlValidateState(validateState);
      return false;
    },
    [validateWebviewSrc],
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

  const webview = useMemo(
    () => (
      <WebView
        key={url}
        siteMode={siteMode}
        androidLayerType={androidLayerType}
        pullToRefreshEnabled={!platformEnv.isNativeAndroid}
        src={url}
        mediaPermissionWhitelist={[...fiatPaySiteWhitelist, ...grantedOrigins]}
        mediaCapturePermissionGrantType={
          platformEnv.isNativeIOS ? 'grantIfSameHostElsePrompt' : undefined
        }
        nativeInjectedJavaScriptBeforeContentLoaded={
          MEDIA_PERMISSION_INTERCEPT_JS
        }
        onMessage={onMessage}
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
          } else {
            void gotoSite({
              url: targetUrl,
              siteMode,
            });
          }
        }}
        allowpopups
        onLoadStart={onLoadStart}
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
      grantedOrigins,
      gotoSite,
      id,
      onMessage,
      showHome,
      siteMode,
      url,
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
    [id, closeWebTab, setCurrentWebTab, urlValidateState],
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
