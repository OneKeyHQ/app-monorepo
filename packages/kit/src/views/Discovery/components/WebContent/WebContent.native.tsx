import type { Dispatch, SetStateAction } from 'react';
import { useCallback, useMemo, useRef } from 'react';

import useBackHandler from '../../../../hooks/useBackHandler';
import { homeTab, setWebTabData } from '../../container/Context/contextWebTabs';
import { onNavigation } from '../../hooks/useWebController';
import { webviewRefs } from '../../utils/explorerUtils';
import { gotoSite } from '../../utils/gotoSite';
import WebView from '../WebView';

import type { IWebTab } from '../../types';
import type {
  WebView as ReactNativeWebview,
  WebViewNavigation,
  WebViewProps,
} from 'react-native-webview';
import type { WebViewNavigationEvent } from 'react-native-webview/lib/WebViewTypes';

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
}: IWebContentProps) {
  const lastNavEventSnapshot = useRef('');
  const showHome = url === homeTab.url;
  // const { setWebTabData } = useWebTabAction();

  const changeNavigationInfo = (siteInfo: WebViewNavigation) => {
    console.log('===>canGoBack: ', siteInfo.canGoBack);
    console.log('===>canGoForward: ', siteInfo.canGoBack);
    console.log('===>siteInfo: ', siteInfo);
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
      if (loading) {
        onNavigation({
          url: navUrl,
          title,
          canGoBack: navCanGoBack,
          canGoForward,
          loading,
          id,
        });
      } else {
        onNavigation({
          title,
          canGoBack: navCanGoBack,
          canGoForward,
          loading,
          id,
        });
      }
    },
    [id],
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
        onLoadStart={onLoadStart}
        onLoadEnd={onLoadEnd as any}
      />
    ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [id, showHome, androidLayerType],
  );
  return webview;
}

export default WebContent;
