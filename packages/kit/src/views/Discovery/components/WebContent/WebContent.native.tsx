import type { Dispatch, SetStateAction } from 'react';
import { useCallback, useMemo, useRef, useState } from 'react';

import { useIntl } from 'react-intl';

import { Dialog, Progress, Stack, useBackHandler } from '@onekeyhq/components';
import WebView from '@onekeyhq/kit/src/components/WebView';
import { handleDeepLinkUrl } from '@onekeyhq/kit/src/routes/config/deeplink';
import {
  homeTab,
  useBrowserAction,
  useBrowserTabActions,
} from '@onekeyhq/kit/src/states/jotai/contexts/discovery';
import { useSettingsFiatPaySiteWhitelistPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms/settings';
import { ETranslations } from '@onekeyhq/shared/src/locale';
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
// The intercepted call returns a Promise that waits for a response event
// dispatched from React Native after the user confirms or denies access.
const MEDIA_PERMISSION_INTERCEPT_JS = `
(function() {
  if (!window.navigator || !window.navigator.mediaDevices || !window.navigator.mediaDevices.getUserMedia) return;
  var _orig = window.navigator.mediaDevices.getUserMedia.bind(window.navigator.mediaDevices);
  window.navigator.mediaDevices.getUserMedia = function(constraints) {
    return new Promise(function(resolve, reject) {
      var requestId = 'media_req_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);

      window.addEventListener('onekey_media_permission_response_' + requestId, function handler(e) {
        window.removeEventListener('onekey_media_permission_response_' + requestId, handler);
        if (e.detail && e.detail.granted) {
          _orig(constraints).then(resolve).catch(reject);
        } else {
          reject(new DOMException('Permission denied', 'NotAllowedError'));
        }
      });

      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'ONEKEY_MEDIA_PERMISSION_REQUEST',
          requestId: requestId,
        }));
      } else {
        _orig(constraints).then(resolve).catch(reject);
      }
    });
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
  const intl = useIntl();
  const lastNavEventSnapshot = useRef('');
  const showHome = url === homeTab.url;
  const [progress, setProgress] = useState(5);
  const [showBlockAccessView, setShowBlockAccessView] = useState(false);
  const [urlValidateState, setUrlValidateState] = useState<EValidateUrlEnum>();
  const [grantedOrigins, setGrantedOrigins] = useState<string[]>([]);
  // Track origins with a pending dialog to prevent duplicate dialogs from rapid calls
  const pendingDialogOrigins = useRef<Set<string>>(new Set());
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
          requestId?: string;
        };
        if (data.type === 'ONEKEY_MEDIA_PERMISSION_REQUEST' && data.requestId) {
          // Derive real origin from the webview URL to prevent spoofing
          const realOrigin = new URL(event.nativeEvent.url).origin;
          const { requestId } = data;

          if (
            fiatPaySiteWhitelist.includes(realOrigin) ||
            grantedOrigins.includes(realOrigin)
          ) {
            // Already granted — respond immediately
            const ref = webviewRefs[id];
            (ref?.innerRef as ReactNativeWebview)?.injectJavaScript(`
              window.dispatchEvent(new CustomEvent('onekey_media_permission_response_${requestId}', { detail: { granted: true } }));
              true;
            `);
            return;
          }

          // Skip if a dialog is already open for this origin
          if (pendingDialogOrigins.current.has(realOrigin)) {
            // Deny this duplicate request
            const ref = webviewRefs[id];
            (ref?.innerRef as ReactNativeWebview)?.injectJavaScript(`
              window.dispatchEvent(new CustomEvent('onekey_media_permission_response_${requestId}', { detail: { granted: false } }));
              true;
            `);
            return;
          }

          pendingDialogOrigins.current.add(realOrigin);

          Dialog.confirm({
            title: intl.formatMessage({
              id: ETranslations.explore_permission_restriction_alert,
            }),
            description: intl.formatMessage(
              {
                id: ETranslations.dapp_connect_allow_this_site_to_access,
              },
              {
                chain: intl.formatMessage({
                  id: ETranslations.explore_camera_permission,
                }),
              },
            ),
            onConfirmText: intl.formatMessage({
              id: ETranslations.global_allow,
            }),
            onConfirm: () => {
              setGrantedOrigins((prev) => [...prev, realOrigin]);
              pendingDialogOrigins.current.delete(realOrigin);
              const ref = webviewRefs[id];
              (ref?.innerRef as ReactNativeWebview)?.injectJavaScript(`
                window.dispatchEvent(new CustomEvent('onekey_media_permission_response_${requestId}', { detail: { granted: true } }));
                true;
              `);
            },
            onClose: () => {
              // Dialog closed without confirming (overlay press, back button, etc.)
              if (pendingDialogOrigins.current.has(realOrigin)) {
                pendingDialogOrigins.current.delete(realOrigin);
                const ref = webviewRefs[id];
                (ref?.innerRef as ReactNativeWebview)?.injectJavaScript(`
                  window.dispatchEvent(new CustomEvent('onekey_media_permission_response_${requestId}', { detail: { granted: false } }));
                  true;
                `);
              }
            },
          });
        }
      } catch {
        // ignore non-JSON messages from the page
      }
    },
    [fiatPaySiteWhitelist, grantedOrigins, id, intl],
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

  const mergedWhitelist = useMemo(
    () => [...fiatPaySiteWhitelist, ...grantedOrigins],
    [fiatPaySiteWhitelist, grantedOrigins],
  );

  const webview = useMemo(
    () => (
      <WebView
        key={url}
        siteMode={siteMode}
        androidLayerType={androidLayerType}
        pullToRefreshEnabled={!platformEnv.isNativeAndroid}
        src={url}
        mediaPermissionWhitelist={
          mergedWhitelist.length > 0 ? mergedWhitelist : undefined
        }
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
      mergedWhitelist,
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
