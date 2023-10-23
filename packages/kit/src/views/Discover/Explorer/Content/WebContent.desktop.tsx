import { useCallback, useMemo } from 'react';

import WebView from '@onekeyhq/kit/src/components/WebView';

import { onNavigation } from '../../Controller/useWebController';
import { webviewRefs } from '../../explorerUtils';
import {
  setWebTabDataAtomWithWriteOnly,
  webTabsStore,
} from '../Context/contextWebTabs';

import type { IElectronWebView } from '../../../../components/WebView/types';
import type { WebTab } from '../Context/contextWebTabs';
import type {
  DidStartNavigationEvent,
  NewWindowEvent,
  PageFaviconUpdatedEvent,
  PageTitleUpdatedEvent,
} from 'electron';
import type { WebViewProps } from 'react-native-webview';

type IWebContentProps = WebTab & WebViewProps;

function WebContent({ id, url }: IWebContentProps) {
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
    ({ url: willNaviUrl, isInPlace, isMainFrame }: DidStartNavigationEvent) => {
      if (isMainFrame) {
        onNavigation({
          id,
          url: willNaviUrl,
          loading: true,
          isInPlace,
          ...getNavStatusInfo(),
        });
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
      if (title) {
        onNavigation({ id, title });
      }
    },
    [id],
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
  const onNewWindow = useCallback(
    ({ url: newWindowUrl }: NewWindowEvent) => {
      if (newWindowUrl) {
        onNavigation({ id, url: newWindowUrl, isNewWindow: true });
      }
    },
    [id],
  );
  const onDomReady = useCallback(() => {
    const ref = webviewRefs[id] as IElectronWebView;
    console.log('====>onDomReady: ', ref);
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
              webTabsStore.set(setWebTabDataAtomWithWriteOnly, {
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
        onNewWindow={onNewWindow}
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
      onNewWindow,
      onPageFaviconUpdated,
      onPageTitleUpdated,
    ],
  );

  return webview;
}

export default WebContent;
