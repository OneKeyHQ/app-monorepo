import type { Dispatch, SetStateAction } from 'react';
import { useCallback, useMemo, useRef, useState } from 'react';

import { Dimensions } from 'react-native';

import {
  Progress,
  RefreshControl,
  ScrollView,
  Stack,
  useBackHandler,
} from '@onekeyhq/components';
import { handleDeepLinkUrl } from '@onekeyhq/kit/src/routes/config/deeplink';
import {
  homeTab,
  useBrowserAction,
  useBrowserTabActions,
} from '@onekeyhq/kit/src/states/jotai/contexts/discovery';
import { EValidateUrlEnum } from '@onekeyhq/shared/types/dappConnection';

import { webviewRefs } from '../../utils/explorerUtils';
import BlockAccessView from '../BlockAccessView';
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
  onScroll,
}: IWebContentProps) {
  const lastNavEventSnapshot = useRef('');
  const showHome = url === homeTab.url;
  const [progress, setProgress] = useState(5);
  const [showBlockAccessView, setShowBlockAccessView] = useState(false);

  const [height, setHeight] = useState(Dimensions.get('screen').height);
  const [isEnabled, setEnabled] = useState(true);
  const [isRefresh] = useState(false);
  const onRefresh = useCallback(() => {
    webviewRefs[id]?.innerRef?.reload();
  }, [id]);
  const [urlValidateState, setUrlValidateState] = useState<EValidateUrlEnum>();
  const { onNavigation, gotoSite, validateWebviewSrc } =
    useBrowserAction().current;
  const { setWebTabData, closeWebTab, setCurrentWebTab } =
    useBrowserTabActions().current;

  const changeNavigationInfo = (siteInfo: WebViewNavigation) => {
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
    [id, onNavigation],
  );

  const onShouldStartLoadWithRequest = useCallback(
    (navigationStateChangeEvent: WebViewNavigation) => {
      const { url: navUrl } = navigationStateChangeEvent;
      const validateState = validateWebviewSrc(navUrl);
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
        androidLayerType={androidLayerType}
        webviewHeight={height}
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
          void gotoSite({ url: e.nativeEvent.targetUrl, userTriggered: true });
        }}
        allowpopups
        onLoadStart={onLoadStart}
        onLoadEnd={onLoadEnd as any}
        onScroll={(e) => {
          setEnabled(e.nativeEvent.contentOffset.y === 0);
          onScroll?.(e);
        }}
        displayProgressBar={false}
        onProgress={(p) => setProgress(p)}
      />
    ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [id, gotoSite, showHome, androidLayerType, height],
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
            closeWebTab(id);
            setCurrentWebTab(null);
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
      {showBlockAccessView ? blockAccessView : null}
    </>
  );
}

export default WebContent;
