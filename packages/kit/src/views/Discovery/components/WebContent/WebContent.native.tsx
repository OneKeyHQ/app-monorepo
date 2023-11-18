import type { Dispatch, SetStateAction } from 'react';
import { useCallback, useMemo, useRef, useState } from 'react';

import { Dimensions } from 'react-native';

import { RefreshControl, ScrollView, Stack } from '@onekeyhq/components';
import uriUtils from '@onekeyhq/shared/src/utils/uriUtils';

import useBackHandler from '../../../../hooks/useBackHandler';
import { onNavigation } from '../../hooks/useWebController';
import { homeTab, setWebTabData } from '../../store/contextWebTabs';
import { webviewRefs } from '../../utils/explorerUtils';
import { gotoSite } from '../../utils/gotoSite';
import PhishingView from '../PhishingView';
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
    addBrowserHistory: (siteInfo: { url: string; title: string }) => void;
  };

function WebContent({
  id,
  url,
  isCurrent,
  androidLayerType,
  canGoBack,
  setBackEnabled,
  setForwardEnabled,
  addBrowserHistory,
}: IWebContentProps) {
  const lastNavEventSnapshot = useRef('');
  const showHome = url === homeTab.url;
  const [showPhishingView, setShowPhishingView] = useState(false);

  const [height, setHeight] = useState(Dimensions.get('screen').height);
  const [isEnabled, setEnabled] = useState(true);
  const [isRefresh, setRefresh] = useState(false);
  const onRefresh = useCallback(() => {
    webviewRefs[id]?.innerRef?.reload();
  }, [id]);

  const changeNavigationInfo = (siteInfo: WebViewNavigation) => {
    // console.log('===>canGoBack: ', siteInfo.canGoBack);
    // console.log('===>canGoForward: ', siteInfo.canGoBack);
    // console.log('===>siteInfo: ', siteInfo);
    setBackEnabled(siteInfo.canGoBack);
    setForwardEnabled(siteInfo.canGoForward);
    addBrowserHistory?.(siteInfo);
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
      const maybeDeepLink =
        !navUrl.startsWith('https') && navUrl !== 'about:blank';
      if (maybeDeepLink) {
        console.log('===>Maybe deeplink, just return');
        const { action } = uriUtils.parseDappRedirect(navUrl);
        console.log('===> action: ', action);
        if (action === uriUtils.EDAppOpenActionEnum.DENY) {
          setShowPhishingView(true);
        }
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
        webviewHeight={height}
        src={url}
        onWebViewRef={(ref) => {
          if (ref && ref.innerRef) {
            if (!webviewRefs[id]) {
              void setWebTabData({
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
        onScroll={(e) => {
          setEnabled(e.nativeEvent.contentOffset.y === 0);
        }}
      />
    ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [id, showHome, androidLayerType, height],
  );

  const phishingView = useMemo(
    () => (
      <Stack position="absolute" top={0} bottom={0} left={0} right={0}>
        <PhishingView />
      </Stack>
    ),
    [],
  );

  return (
    <>
      <ScrollView
        flex={1}
        onLayout={(e) => {
          setHeight(e.nativeEvent.layout.height);
        }}
        refreshControl={
          <RefreshControl
            onRefresh={onRefresh}
            refreshing={isRefresh}
            enabled={isEnabled}
          />
        }
      >
        {webview}
      </ScrollView>
      {showPhishingView && phishingView}
    </>
  );
}

export default WebContent;
