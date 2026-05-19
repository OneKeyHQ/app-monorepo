import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { Stack } from '@onekeyhq/components';
import WebView from '@onekeyhq/kit/src/components/WebView';
import type { PageFaviconUpdatedEvent } from '@onekeyhq/kit/src/components/WebView/DesktopWebView';
import {
  notifyTabNavigation,
  notifyTabNavigationEnd,
} from '@onekeyhq/kit/src/components/WebView/translateBridge';
import type { IElectronWebView } from '@onekeyhq/kit/src/components/WebView/types';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { handleDeepLinkUrl } from '@onekeyhq/kit/src/routes/config/deeplink';
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
import type { ShouldStartLoadRequest } from 'react-native-webview/lib/WebViewTypes';

type IWebContentProps = IWebTab &
  WebViewProps & {
    isCurrent?: boolean;
    customReceiveHandler?: IJsBridgeReceiveHandler;
  };

function shouldBlockAccess(validateState: EValidateUrlEnum | undefined) {
  return (
    Boolean(validateState) &&
    validateState !== EValidateUrlEnum.Valid &&
    validateState !== EValidateUrlEnum.ValidDeeplink
  );
}

function WebContent({ id, url, customReceiveHandler }: IWebContentProps) {
  const navigation = useAppNavigation();
  const urlRef = useRef<string>('');
  const phishingUrlRef = useRef<string>('');
  const [navigationBlockAccessView, setNavigationBlockAccessView] =
    useState(false);
  const [navigationUrlValidateState, setNavigationUrlValidateState] =
    useState<EValidateUrlEnum>();
  const [navigationBlockedUrl, setNavigationBlockedUrl] = useState<string>();
  const { setWebTabData, closeWebTab, setCurrentWebTab, getWebTabById } =
    useBrowserTabActions().current;
  const { onNavigation, validateWebviewSrc } = useBrowserAction().current;
  const currentUrlValidateState = useMemo(() => {
    const result = validateWebviewSrc({ url, isTopFrame: true });
    return result;
  }, [url, validateWebviewSrc]);
  const shouldBlockCurrentUrl = shouldBlockAccess(currentUrlValidateState);
  const showBlockAccessView =
    shouldBlockCurrentUrl || navigationBlockAccessView;
  const urlValidateState = shouldBlockCurrentUrl
    ? currentUrlValidateState
    : navigationUrlValidateState;
  const blockedUrl = shouldBlockCurrentUrl ? url : navigationBlockedUrl;

  useEffect(() => {
    setNavigationBlockAccessView(false);
    setNavigationUrlValidateState(undefined);
    setNavigationBlockedUrl(undefined);
  }, [id, url]);

  useEffect(() => {
    if (!shouldBlockCurrentUrl) {
      return;
    }
    const ref = webviewRefs[id]?.innerRef as IElectronWebView | undefined;
    try {
      ref?.stop?.();
    } catch {
      // noop
    }
    delete webviewRefs[id];
  }, [id, shouldBlockCurrentUrl]);

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
        setNavigationBlockAccessView(false);
        setNavigationUrlValidateState(undefined);
        setNavigationBlockedUrl(undefined);
        notifyTabNavigation(id);
        onNavigation({
          id,
          url: willNavigationUrl,
          loading: true,
          isInPlace: true,
          ...getNavStatusInfo(),
          handlePhishingUrl: (illegalUrl) => {
            setNavigationBlockAccessView(true);
            setNavigationUrlValidateState(EValidateUrlEnum.NotSupportProtocol);
            setNavigationBlockedUrl(illegalUrl);
            phishingUrlRef.current = illegalUrl;
          },
        });
        urlRef.current = willNavigationUrl;
      }
    },
    [getNavStatusInfo, id, onNavigation],
  );
  const onDidFinishLoad = useCallback(() => {
    notifyTabNavigationEnd(id);
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
  const onShouldStartLoadWithRequest = useCallback(
    (navigationStateChangeEvent: ShouldStartLoadRequest) => {
      const { url: navUrl, isTopFrame } = navigationStateChangeEvent;
      const validateState = validateWebviewSrc({
        url: navUrl,
        isTopFrame,
      });
      if (validateState === EValidateUrlEnum.Valid) {
        return true;
      }
      if (validateState === EValidateUrlEnum.ValidDeeplink) {
        handleDeepLinkUrl({ url: navUrl });
        return false;
      }
      setNavigationBlockAccessView(true);
      setNavigationUrlValidateState(validateState);
      setNavigationBlockedUrl(navUrl);
      phishingUrlRef.current = navUrl;
      return false;
    },
    [validateWebviewSrc],
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
      if (shouldBlockCurrentUrl) {
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
          onShouldStartLoadWithRequest={onShouldStartLoadWithRequest}
          onPageTitleUpdated={onPageTitleUpdated}
          onPageFaviconUpdated={onPageFaviconUpdated}
          onDomReady={onDomReady}
          displayProgressBar
        />
      );
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      id,
      onDidFinishLoad,
      onDidStartLoading,
      onDidStartNavigation,
      onShouldStartLoadWithRequest,
      onDomReady,
      shouldBlockCurrentUrl,
      customReceiveHandler,
      // onPageTitleUpdated,
      // onPageFaviconUpdated,
    ],
  );

  const blockAccessView = useMemo(
    () => (
      <Stack
        position="absolute"
        top={0}
        bottom={0}
        left={0}
        right={0}
        zIndex={1}
        bg="$bgApp"
      >
        <BlockAccessView
          url={blockedUrl}
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
      </Stack>
    ),
    [
      blockedUrl,
      closeWebTab,
      setCurrentWebTab,
      id,
      navigation,
      urlValidateState,
    ],
  );

  return (
    <Stack flex={1} position="relative" bg="$bgApp">
      {webview}
      {showBlockAccessView ? blockAccessView : null}
    </Stack>
  );
}

export default WebContent;
