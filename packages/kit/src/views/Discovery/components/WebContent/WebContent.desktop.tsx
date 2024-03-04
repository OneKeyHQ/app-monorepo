import { useCallback, useMemo, useRef, useState } from 'react';

import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { ETabRoutes } from '@onekeyhq/kit/src/routes/Tab/type';
import {
  useBrowserAction,
  useBrowserTabActions,
} from '@onekeyhq/kit/src/states/jotai/contexts/discovery';

import { webviewRefs } from '../../utils/explorerUtils';
import PhishingView from '../PhishingView';
import WebView from '../WebView';

import type { IWebTab } from '../../types';
import type { IElectronWebView } from '../WebView/types';
import type {
  DidStartNavigationEvent,
  PageFaviconUpdatedEvent,
  PageTitleUpdatedEvent,
} from 'electron';
import type { WebViewProps } from 'react-native-webview';

type IWebContentProps = IWebTab &
  WebViewProps & {
    addBrowserHistory?: (siteInfo: { url: string; title: string }) => void;
  };

function WebContent({ id, url, addBrowserHistory }: IWebContentProps) {
  const navigation = useAppNavigation();
  const urlRef = useRef<string>('');
  const phishingUrlRef = useRef<string>('');
  const [showPhishingView, setShowPhishingView] = useState(false);
  const { setWebTabData, closeWebTab, setCurrentWebTab } =
    useBrowserTabActions().current;
  const { onNavigation, addUrlToPhishingCache } = useBrowserAction().current;
  const getNavStatusInfo = useCallback(() => {
    const ref = webviewRefs[id];
    const webviewRef = ref.innerRef as IElectronWebView;
    if (!webviewRef) {
      return;
    }
    try {
      return {
        title: webviewRef.getTitle(),
        canGoBack: webviewRef.canGoBack(),
        canGoForward: webviewRef.canGoForward(),
      };
    } catch {
      return undefined;
    }
  }, [id]);
  const onDidStartLoading = useCallback(() => {
    onNavigation({ id, loading: true });
  }, [id, onNavigation]);
  const onDidStartNavigation = useCallback(
    ({
      url: willNavigationUrl,
      isInPlace,
      isMainFrame,
    }: DidStartNavigationEvent) => {
      if (isMainFrame) {
        onNavigation({
          id,
          url: willNavigationUrl,
          loading: true,
          isInPlace,
          ...getNavStatusInfo(),
          handlePhishingUrl: (illegalUrl) => {
            console.log('=====>>>>: handlePhishingUrl', illegalUrl);
            setShowPhishingView(true);
            phishingUrlRef.current = illegalUrl;
          },
        });
        urlRef.current = willNavigationUrl;
      }
    },
    [getNavStatusInfo, id, onNavigation],
  );
  const onDidFinishLoad = useCallback(() => {
    onNavigation({
      id,
      loading: false,
      ...getNavStatusInfo(),
    });
  }, [getNavStatusInfo, id, onNavigation]);
  const onPageTitleUpdated = useCallback(
    ({ title }: PageTitleUpdatedEvent) => {
      if (title && title.length) {
        onNavigation({ id, title });
        if (urlRef.current) {
          addBrowserHistory?.({
            url: urlRef.current,
            title,
          });
        }
      }
    },
    [id, addBrowserHistory, onNavigation],
  );
  const onPageFaviconUpdated = useCallback(
    ({ favicons }: PageFaviconUpdatedEvent) => {
      if (favicons.length > 0) {
        onNavigation({
          id,
          favicon: favicons[0],
        });
      }
    },
    [id, onNavigation],
  );
  const onDomReady = useCallback(() => {
    const ref = webviewRefs[id] as IElectronWebView;
    // @ts-expect-error
    ref.__domReady = true;
  }, [id]);
  const webview = useMemo(
    () => (
      <WebView
        id={id}
        src={url}
        onWebViewRef={(ref) => {
          if (ref && ref.innerRef) {
            if (!webviewRefs[id]) {
              void setWebTabData({
                id,
                refReady: true,
              });
            }
            webviewRefs[id] = ref;
          }
        }}
        allowpopups
        onDidStartLoading={onDidStartLoading}
        onDidStartNavigation={onDidStartNavigation}
        onDidFinishLoad={onDidFinishLoad}
        onDidStopLoading={onDidFinishLoad}
        onDidFailLoad={onDidFinishLoad}
        onPageTitleUpdated={onPageTitleUpdated}
        onPageFaviconUpdated={onPageFaviconUpdated}
        // onNewWindow={onNewWindow}
        onDomReady={onDomReady}
      />
    ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      id,
      onDidFinishLoad,
      onDidStartLoading,
      onDidStartNavigation,
      onDomReady,
      // onNewWindow,
      onPageFaviconUpdated,
      onPageTitleUpdated,
    ],
  );

  const phishingView = useMemo(
    () => (
      <PhishingView
        onCloseTab={() => {
          closeWebTab(id);
          setCurrentWebTab(null);
          navigation.switchTab(ETabRoutes.Discovery);
        }}
        onContinue={() => {
          addUrlToPhishingCache({ url: phishingUrlRef.current });
          setShowPhishingView(false);
        }}
      />
    ),
    [closeWebTab, setCurrentWebTab, addUrlToPhishingCache, id, navigation],
  );

  return (
    <>
      {webview}
      {showPhishingView && phishingView}
    </>
  );
}

export default WebContent;
