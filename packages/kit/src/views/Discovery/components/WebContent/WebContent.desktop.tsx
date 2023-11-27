import { useCallback, useMemo, useRef, useState } from 'react';

import { Stack } from '@onekeyhq/components';

import { onNavigation } from '../../hooks/useWebController';
import useWebTabAction from '../../hooks/useWebTabAction';
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
  const urlRef = useRef<string>('');
  const [showPhishingView, setShowPhishingView] = useState(false);
  const { setWebTabData, closeWebTab } = useWebTabAction();
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
  }, [id]);
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
          },
        });
        urlRef.current = willNavigationUrl;
      }
    },
    [getNavStatusInfo, id],
  );
  const onDidFinishLoad = useCallback(() => {
    onNavigation({
      id,
      loading: false,
      ...getNavStatusInfo(),
    });
  }, [getNavStatusInfo, id]);
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
    [id, addBrowserHistory],
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
    [id],
  );
  // const onNewWindow = useCallback(
  //   ({ url: newWindowUrl }: NewWindowEvent) => {
  //     if (newWindowUrl) {
  //       onNavigation({ id, url: newWindowUrl, isNewWindow: true });
  //     }
  //   },
  //   [id],
  // );
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
    () => <PhishingView onCloseTab={() => closeWebTab(id)} />,
    [closeWebTab, id],
  );

  return (
    <>
      {webview}
      {showPhishingView && phishingView}
    </>
  );
}

export default WebContent;
