import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import {
  useBrowserAction,
  useBrowserTabActions,
} from '@onekeyhq/kit/src/states/jotai/contexts/discovery';
import { ETabRoutes } from '@onekeyhq/shared/src/routes';
import { EValidateUrlEnum } from '@onekeyhq/shared/types/dappConnection';

import { webviewRefs } from '../../utils/explorerUtils';
import BlockAccessView from '../BlockAccessView';
import WebView from '../WebView';

import type { IWebTab } from '../../types';
import type { PageFaviconUpdatedEvent } from '../WebView/DesktopWebView';
import type { IElectronWebView } from '../WebView/types';
import type { DidStartNavigationEvent, PageTitleUpdatedEvent } from 'electron';
import type { WebViewProps } from '@onekeyfe/react-native-webview';

type IWebContentProps = IWebTab &
  WebViewProps & {
    addBrowserHistory?: (siteInfo: { url: string; title: string }) => void;
  };

function WebContent({ id, url, addBrowserHistory }: IWebContentProps) {
  const navigation = useAppNavigation();
  const urlRef = useRef<string>('');
  const phishingUrlRef = useRef<string>('');
  const [showBlockAccessView, setShowBlockAccessView] = useState(false);
  const [urlValidateState, setUrlValidateState] = useState<EValidateUrlEnum>();
  const { setWebTabData, closeWebTab, setCurrentWebTab, getWebTabById } =
    useBrowserTabActions().current;
  const { onNavigation, validateWebviewSrc } = useBrowserAction().current;
  useEffect(() => {
    const validateState = validateWebviewSrc(url);
    setUrlValidateState(validateState);
    setShowBlockAccessView(
      validateState !== EValidateUrlEnum.Valid &&
        validateState !== EValidateUrlEnum.ValidDeeplink,
    );
  }, [url, validateWebviewSrc]);

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
            setShowBlockAccessView(true);
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
    async (e: PageFaviconUpdatedEvent) => {
      // Ensure the e.favicons array is not empty, and there's an existing favicon URL
      if (e.favicons.length > 0) {
        let shouldUpdateFavicon = false;
        const tabData = getWebTabById(id);
        if (!tabData?.favicon) {
          shouldUpdateFavicon = true;
        } else {
          const newFaviconURL = new URL(e.favicons[0]);
          const oldFaviconURL = new URL(tabData?.favicon);
          // Check if the origin of the new and old favicon URLs are different
          if (newFaviconURL.origin !== oldFaviconURL.origin) {
            shouldUpdateFavicon = true;
          }
        }
        if (shouldUpdateFavicon) {
          const newFavicon =
            await backgroundApiProxy.serviceDiscovery.buildWebsiteIconUrl(
              tabData?.url ?? '',
            );
          setWebTabData({
            id,
            favicon: newFavicon,
          });
        }
      }
    },
    [getWebTabById, id, setWebTabData],
  );
  const onDomReady = useCallback(() => {
    const ref = webviewRefs[id] as IElectronWebView;
    // @ts-expect-error
    ref.__domReady = true;
  }, [id]);
  const webview = useMemo(
    () => {
      const isValidate = validateWebviewSrc(url);
      if (!isValidate) {
        return null;
      }
      return (
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
          onDomReady={onDomReady}
        />
      );
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      id,
      onDidFinishLoad,
      onDidStartLoading,
      onDidStartNavigation,
      onDomReady,
      // onPageTitleUpdated,
      // onPageFaviconUpdated,
    ],
  );

  const blockAccessView = useMemo(
    () => (
      <BlockAccessView
        urlValidateState={urlValidateState}
        onCloseTab={() => {
          closeWebTab(id);
          setCurrentWebTab(null);
          navigation.switchTab(ETabRoutes.Discovery);
        }}
        // onContinue={() => {
        //   addUrlToPhishingCache({ url: phishingUrlRef.current });
        //   setShowPhishingView(false);
        // }}
      />
    ),
    [closeWebTab, setCurrentWebTab, id, navigation, urlValidateState],
  );

  return (
    <>
      {webview}
      {showBlockAccessView ? blockAccessView : null}
    </>
  );
}

export default WebContent;
