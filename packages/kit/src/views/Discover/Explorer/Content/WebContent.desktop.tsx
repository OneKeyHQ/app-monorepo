import { useCallback, useMemo } from 'react';

import WebView from '@onekeyhq/kit/src/components/WebView';

import { webviewRefs } from '../../explorerUtils';
import { useWebTabsActions } from '../Context/contextWebTabs';

import type { IElectronWebView } from '../../../../components/WebView/types';
import type { WebTab } from '../Context/contextWebTabs';
import type {
  DidStartNavigationEvent,
  PageFaviconUpdatedEvent,
  PageTitleUpdatedEvent,
} from 'electron';
import type { WebViewProps } from 'react-native-webview';

type IWebContentProps = WebTab & WebViewProps;

function WebContent({ id, url }: IWebContentProps) {
  const actions = useWebTabsActions();
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
    actions.handleWebviewNavigation({ id, loading: true });
  }, [actions, id]);
  const onDidStartNavigation = useCallback(
    ({
      url: willNavigationUrl,
      isInPlace,
      isMainFrame,
    }: DidStartNavigationEvent) => {
      if (isMainFrame) {
        actions.handleWebviewNavigation({
          id,
          url: willNavigationUrl,
          loading: true,
          isInPlace,
          ...getNavStatusInfo(),
        });
      }
    },
    [actions, getNavStatusInfo, id],
  );
  const onDidFinishLoad = useCallback(() => {
    actions.handleWebviewNavigation({
      id,
      loading: false,
      ...getNavStatusInfo(),
    });
  }, [actions, getNavStatusInfo, id]);
  const onPageTitleUpdated = useCallback(
    ({ title }: PageTitleUpdatedEvent) => {
      if (title) {
        actions.handleWebviewNavigation({ id, title });
      }
    },
    [actions, id],
  );
  const onPageFaviconUpdated = useCallback(
    ({ favicons }: PageFaviconUpdatedEvent) => {
      if (favicons.length > 0) {
        actions.handleWebviewNavigation({
          id,
          favicon: favicons[0],
        });
      }
    },
    [actions, id],
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
              actions.setWebTabData({
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

  return webview;
}

export default WebContent;
