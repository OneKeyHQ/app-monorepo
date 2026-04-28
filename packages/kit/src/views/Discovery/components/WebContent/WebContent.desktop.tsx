import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import WebView from '@onekeyhq/kit/src/components/WebView';
import type { PageFaviconUpdatedEvent } from '@onekeyhq/kit/src/components/WebView/DesktopWebView';
import { notifyTabNavigation } from '@onekeyhq/kit/src/components/WebView/translateBridge';
import type { IElectronWebView } from '@onekeyhq/kit/src/components/WebView/types';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import {
  useBrowserAction,
  useBrowserTabActions,
} from '@onekeyhq/kit/src/states/jotai/contexts/discovery';
import { ETabRoutes } from '@onekeyhq/shared/src/routes';
import uriUtils from '@onekeyhq/shared/src/utils/uriUtils';
import { EValidateUrlEnum } from '@onekeyhq/shared/types/dappConnection';

import {
  BITREFILL_BRIDGE_SCRIPT,
  isBitrefillEmbedUrl,
} from '../../utils/bitrefillUtils';
import { webviewRefs } from '../../utils/explorerUtils';
import BlockAccessView from '../BlockAccessView';

import type { IWebTab } from '../../types';
import type { IJsBridgeReceiveHandler } from '@onekeyfe/cross-inpage-provider-types';
import type { DidStartNavigationEvent, PageTitleUpdatedEvent } from 'electron';
import type { WebViewProps } from 'react-native-webview';

type IWebContentProps = IWebTab &
  WebViewProps & {
    isCurrent?: boolean;
    customReceiveHandler?: IJsBridgeReceiveHandler;
  };

function WebContent({ id, url, customReceiveHandler }: IWebContentProps) {
  const navigation = useAppNavigation();
  const urlRef = useRef<string>('');
  const phishingUrlRef = useRef<string>('');
  const [showBlockAccessView, setShowBlockAccessView] = useState(false);
  const [urlValidateState, setUrlValidateState] = useState<EValidateUrlEnum>();
  const { setWebTabData, closeWebTab, setCurrentWebTab, getWebTabById } =
    useBrowserTabActions().current;
  const { onNavigation, validateWebviewSrc } = useBrowserAction().current;
  useEffect(() => {
    const validateState = validateWebviewSrc({ url, isTopFrame: true });
    setUrlValidateState(validateState);
    setShowBlockAccessView(
      validateState !== EValidateUrlEnum.Valid &&
        validateState !== EValidateUrlEnum.ValidDeeplink,
    );
  }, [url, validateWebviewSrc]);

  const getNavStatusInfo = useCallback(() => {
    const ref = webviewRefs[id];
    // Fix: Prevent crash when ref is undefined during webview destruction or race conditions
    const webviewRef = ref?.innerRef as IElectronWebView;
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
    ({ url: willNavigationUrl, isMainFrame }: DidStartNavigationEvent) => {
      if (isMainFrame) {
        notifyTabNavigation(id);
        onNavigation({
          id,
          url: willNavigationUrl,
          loading: true,
          isInPlace: true,
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
      }
    },
    [id, onNavigation],
  );
  const onPageFaviconUpdated = useCallback(
    (e: PageFaviconUpdatedEvent) => {
      if (e.favicons.length > 0) {
        const newFavicon = e.favicons[0];
        const newOrigin = uriUtils.getOriginFromUrl({ url: newFavicon });
        if (!newOrigin) return;
        const oldOrigin = uriUtils.getOriginFromUrl({
          url: getWebTabById(id)?.favicon ?? '',
        });
        if (newOrigin !== oldOrigin) {
          setWebTabData({ id, favicon: newFavicon });
        }
      }
    },
    [getWebTabById, id, setWebTabData],
  );
  // Keep a ref to the latest url so onDomReady can read it without depending
  // on `url`. Making `url` a dep of onDomReady invalidates the `webview`
  // useMemo below, forces React to replace the <WebView> element, and lets
  // Electron rebuild the webview instance — which wipes in-flight DApp
  // state (e.g. the Bitrefill checkout page would redirect back to
  // payment-method mid-flow).
  const latestUrlRef = useRef(url);
  useEffect(() => {
    latestUrlRef.current = url;
  }, [url]);

  const onDomReady = useCallback(() => {
    const ref = webviewRefs[id];
    if (ref) {
      // @ts-expect-error
      ref.__domReady = true;
    }
    // Inject the Bitrefill bridge on every dom-ready so raw window.postMessage
    // events from embed.bitrefill.com are re-emitted as $private JSBridge
    // requests reaching useDiscoveryMessageHandler.
    const currentUrl = latestUrlRef.current;
    if (isBitrefillEmbedUrl(currentUrl)) {
      const webviewEl = ref?.innerRef as IElectronWebView | undefined;
      try {
        const result = webviewEl?.executeJavaScript?.(BITREFILL_BRIDGE_SCRIPT);
        if (result && typeof (result as Promise<unknown>).then === 'function') {
          (result as Promise<unknown>).catch(() => {
            // best-effort injection
          });
        }
      } catch {
        // best-effort injection
      }
    }
  }, [id]);

  const webview = useMemo(
    () => {
      const isValidate = validateWebviewSrc({ url, isTopFrame: true });
      if (!isValidate) {
        return null;
      }
      return (
        <WebView
          id={id}
          src={url}
          customReceiveHandler={customReceiveHandler}
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
      customReceiveHandler,
      // onPageTitleUpdated,
      // onPageFaviconUpdated,
    ],
  );

  const blockAccessView = useMemo(
    () => (
      <BlockAccessView
        urlValidateState={urlValidateState}
        onCloseTab={() => {
          closeWebTab({ tabId: id, entry: 'BlockView' });
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
