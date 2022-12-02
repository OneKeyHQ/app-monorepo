import { FC, useCallback, useEffect, useMemo, useRef } from 'react';

import * as Linking from 'expo-linking';
import { BackHandler } from 'react-native';

import WebView from '@onekeyhq/kit/src/components/WebView';

import backgroundApiProxy from '../../../../background/instance/backgroundApiProxy';
import {
  WebTab,
  homeTab,
  setWebTabData,
} from '../../../../store/reducers/webTabs';
import { gotoSite } from '../Controller/gotoSite';
import { onNavigation } from '../Controller/useWebController';
import { MAX_OR_SHOW, expandAnim } from '../explorerAnimation';
import { webviewRefs } from '../explorerUtils';

import type { WebViewNavigation, WebViewProps } from 'react-native-webview';

const WebContent: FC<WebTab & WebViewProps> = ({
  id,
  url,
  isCurrent,
  androidLayerType,
  canGoBack,
}) => {
  const lastNavEventSnapshot = useRef('');
  const showHome = url === homeTab.url;

  const onNavigationStateChange = useCallback(
    (navigationStateChangeEvent: WebViewNavigation) => {
      if (showHome) {
        return;
      }
      const snapshot = JSON.stringify(navigationStateChangeEvent);
      if (snapshot === lastNavEventSnapshot.current) {
        return;
      }
      lastNavEventSnapshot.current = snapshot;
      const {
        // eslint-disable-next-line @typescript-eslint/no-shadow
        canGoBack,
        canGoForward,
        loading,
        title,
        url: navUrl,
      } = navigationStateChangeEvent;
      const isDeepLink = !navUrl.startsWith('http') && navUrl !== 'about:blank';
      if (isDeepLink) {
        // @ts-ignore
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
        webviewRefs[id]?.innerRef?.stopLoading();
        // canOpenURL may need additional config on android 11+
        // https://github.com/facebook/react-native/issues/32311#issuecomment-933568611
        // so just try open directly
        Linking.openURL(navUrl).catch();
        return;
      }
      if (loading) {
        onNavigation({ url: navUrl, title, canGoBack, canGoForward, loading });
      } else {
        onNavigation({ title, canGoBack, canGoForward, loading });
      }
    },
    [id, showHome],
  );

  useEffect(() => {
    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        if (
          isCurrent &&
          expandAnim.value === MAX_OR_SHOW &&
          webviewRefs[id] &&
          canGoBack &&
          id !== homeTab.id
        ) {
          // @ts-ignore
          // eslint-disable-next-line @typescript-eslint/no-unsafe-call
          webviewRefs[id]?.innerRef?.goBack();
          return true;
        }
        return false;
      },
    );

    return () => subscription.remove();
  }, [canGoBack, id, isCurrent]);

  const webview = useMemo(
    () => (
      <WebView
        key={String(showHome)}
        androidLayerType={androidLayerType}
        src={url}
        onWebViewRef={(ref) => {
          const { dispatch } = backgroundApiProxy;
          if (ref && ref.innerRef) {
            if (!webviewRefs[id]) {
              dispatch(setWebTabData({ id, refReady: true }));
            }
            webviewRefs[id] = ref;
          }
        }}
        onNavigationStateChange={onNavigationStateChange}
        onOpenWindow={(e) => {
          gotoSite({ url: e.nativeEvent.targetUrl });
        }}
        allowpopups
      />
    ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [id, showHome, androidLayerType],
  );

  return webview;
};

WebContent.displayName = 'WebContent';

export default WebContent;
