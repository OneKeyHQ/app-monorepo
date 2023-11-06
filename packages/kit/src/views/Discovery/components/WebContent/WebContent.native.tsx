import { useCallback, useMemo, useRef } from 'react';

import useBackHandler from '../../../../hooks/useBackHandler';
import { homeTab } from '../../container/Context/contextWebTabs';
import { onNavigation } from '../../hooks/useWebController';
import useWebTabAction from '../../hooks/useWebTabAction';
import { webviewRefs } from '../../utils/explorerUtils';
import { gotoSite } from '../../utils/gotoSite';
import WebView from '../WebView';

import type { IWebTab } from '../../types';
import type {
  WebView as ReactNativeWebview,
  WebViewNavigation,
  WebViewProps,
} from 'react-native-webview';

function WebContent({
  id,
  url,
  isCurrent,
  androidLayerType,
  canGoBack,
}: IWebTab & WebViewProps & { isCurrent: boolean }) {
  const lastNavEventSnapshot = useRef('');
  const showHome = url === homeTab.url;
  const { setWebTabData } = useWebTabAction();

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
        canGoBack: navCanGoBack,
        canGoForward,
        loading,
        title,
        url: navUrl,
      } = navigationStateChangeEvent;
      if (loading) {
        console.log('=> loading state: ', {
          url: navUrl,
          title,
          canGoBack: navCanGoBack,
          canGoForward,
          loading,
          id,
        });
        onNavigation({
          url: navUrl,
          title,
          canGoBack: navCanGoBack,
          canGoForward,
          loading,
          id,
        });
      } else {
        console.log('$=> stop loading: ', {
          title,
          canGoBack: navCanGoBack,
          canGoForward,
          loading,
          id,
        });
        onNavigation({
          title,
          canGoBack: navCanGoBack,
          canGoForward,
          loading,
          id,
        });
      }
    },
    [id, showHome],
  );

  const onShouldStartLoadWithRequest = useCallback(
    (navigationStateChangeEvent: WebViewNavigation) => {
      const { url: navUrl } = navigationStateChangeEvent;
      const isDeepLink = !navUrl.startsWith('http') && navUrl !== 'about:blank';
      if (isDeepLink) {
        console.log('===>Maybe deeplink, just return');
        return false;
      }
      return true;
    },
    [],
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
        androidLayerType={androidLayerType}
        src={url}
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
          gotoSite({ url: e.nativeEvent.targetUrl, userTriggered: true });
        }}
        allowpopups
      />
    ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [id, showHome, androidLayerType],
  );
  return webview;
}

export default WebContent;
