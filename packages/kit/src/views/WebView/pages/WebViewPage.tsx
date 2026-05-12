import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useWebViewBridge } from '@onekeyfe/onekey-cross-webview';
import { useNavigation, useRoute } from '@react-navigation/core';

import { Page, useBackHandler, useOnRouterChange } from '@onekeyhq/components';
import WebView from '@onekeyhq/kit/src/components/WebView';
import type { IElectronWebView } from '@onekeyhq/kit/src/components/WebView/types';
import { useBrowserHistoryAction } from '@onekeyhq/kit/src/states/jotai/contexts/discovery';
import { DiscoveryBrowserProviderMirror } from '@onekeyhq/kit/src/views/Discovery/components/DiscoveryBrowserProviderMirror';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import {
  ERootRoutes,
  type IWebViewPageParams,
} from '@onekeyhq/shared/src/routes';
import { openUrlExternal } from '@onekeyhq/shared/src/utils/openUrlUtils';
import { isAllowedWebViewUrl } from '@onekeyhq/shared/src/utils/webViewUrlSafety';

import AddressBar from '../components/AddressBar';
import WebViewHeader from '../components/Header';
import ProgressBar from '../components/ProgressBar';
import { useOverlayDesktopPopup } from '../hooks/useOverlayDesktopPopup';
import { resolveOverlayDisplay } from '../utils/displayPolicy';
import { registerOverlayWebContentsId } from '../utils/overlayContentsRegistry';

import type { WebView as ReactNativeWebView } from 'react-native-webview';
import type {
  ShouldStartLoadRequest,
  WebViewNavigation,
  WebViewOpenWindowEvent,
} from 'react-native-webview/lib/WebViewTypes';

// Empty whitelist denies getUserMedia (camera/mic) on iOS and Android, even
// when the app already holds OS-level CAMERA / RECORD_AUDIO grants — without
// this, RN WebView falls through to the default permission grant path which
// on Android silently grants any origin once OS permission is held.
// Module-scope constant so the array reference stays stable across renders.
const OVERLAY_NO_MEDIA_WHITELIST: string[] = [];

function WebViewPageContent() {
  const route = useRoute();
  const navigation = useNavigation();
  const params = (route.params ?? {}) as IWebViewPageParams;
  const initialUrl = params.url ?? '';

  const { webviewRef, setWebViewRef } = useWebViewBridge();

  const [currentUrl, setCurrentUrl] = useState(initialUrl);
  const [currentTitle, setCurrentTitle] = useState<string>('');
  const [progress, setProgress] = useState(initialUrl ? 5 : 100);
  const [canGoBack, setCanGoBack] = useState(false);
  const [desktopContentsId, setDesktopContentsId] = useState<number | null>(
    null,
  );

  const lastHistoryUrlRef = useRef<string>('');
  const currentTitleRef = useRef<string>('');
  const isClosingRef = useRef<boolean>(false);
  const { addBrowserHistory } = useBrowserHistoryAction().current;

  // Keep title state and ref in sync. The ref lets the history-write effect
  // read the latest title without re-running on every title change (which
  // would short-circuit on the URL ref-equality guard).
  const updateCurrentTitle = useCallback((nextTitle: string) => {
    currentTitleRef.current = nextTitle;
    setCurrentTitle(nextTitle);
  }, []);

  // ----------------------------------------------------------------------
  // URL / title tracking — native uses onNavigationStateChange, desktop uses
  // separate did-start-navigation + page-title-updated events.
  // ----------------------------------------------------------------------
  const onNavigationStateChange = useCallback(
    (navState: WebViewNavigation) => {
      if (typeof navState.url === 'string' && navState.url) {
        setCurrentUrl(navState.url);
      }
      if (typeof navState.title === 'string') {
        updateCurrentTitle(navState.title);
      }
      setCanGoBack(Boolean(navState.canGoBack));
    },
    [updateCurrentTitle],
  );

  const refreshElectronCanGoBack = useCallback(() => {
    if (!platformEnv.isDesktop) return;
    const innerRef = webviewRef.current?.innerRef as
      | IElectronWebView
      | undefined;
    if (!innerRef) return;
    try {
      setCanGoBack(Boolean(innerRef.canGoBack?.()));
    } catch {
      // Electron webview not yet ready; ignore.
    }
  }, [webviewRef]);

  // Capture the Electron <webview>'s contents id once it's available. The
  // captured id is then mirrored to (a) the renderer-side overlay registry
  // so Discovery's popup listener skips overlay-sourced events, and (b) the
  // main-process overlay registry via `useOverlayDesktopPopup` so
  // `will-redirect` / `will-navigate` apply the strict overlay URL policy
  // before any network request is sent.
  const ensureDesktopContentsIdCaptured = useCallback(() => {
    if (!platformEnv.isDesktop) return;
    if (desktopContentsId !== null) return;
    const innerRef = webviewRef.current?.innerRef as
      | IElectronWebView
      | undefined;
    if (!innerRef?.getWebContentsId) return;
    try {
      const id = innerRef.getWebContentsId();
      if (typeof id !== 'number') return;
      setDesktopContentsId(id);
    } catch {
      // contents not yet attached — retry on next navigation event
    }
  }, [desktopContentsId, webviewRef]);

  const onDidStartNavigation = useCallback(
    (event: { url: string; isMainFrame: boolean }) => {
      if (!event?.isMainFrame) return;
      if (event.url) {
        setCurrentUrl(event.url);
      }
      refreshElectronCanGoBack();
      ensureDesktopContentsIdCaptured();
    },
    [ensureDesktopContentsIdCaptured, refreshElectronCanGoBack],
  );

  // Hook the contents id into both the renderer-side overlay registry
  // (Discovery's popup listener filter) and the main-process registry
  // (pre-navigation guard for SSRF-class redirects).
  useEffect(() => {
    if (desktopContentsId === null) return;
    const cleanup = registerOverlayWebContentsId(desktopContentsId);
    return () => {
      cleanup();
    };
  }, [desktopContentsId]);

  const onPageTitleUpdated = useCallback(
    (event: { title: string }) => {
      if (event?.title) {
        updateCurrentTitle(event.title);
      }
    },
    [updateCurrentTitle],
  );

  const onDidFinishLoad = useCallback(() => {
    refreshElectronCanGoBack();
    setProgress(100);
  }, [refreshElectronCanGoBack]);

  // ----------------------------------------------------------------------
  // Imperative controls
  // ----------------------------------------------------------------------
  const handleReload = useCallback(() => {
    try {
      webviewRef.current?.reload?.();
    } catch {
      // ignore — best-effort
    }
  }, [webviewRef]);

  const handleWebViewGoBack = useCallback((): boolean => {
    const inner = webviewRef.current?.innerRef;
    if (!inner) return false;
    try {
      if (platformEnv.isDesktop) {
        const electronRef = inner as IElectronWebView;
        if (electronRef.canGoBack?.()) {
          electronRef.goBack();
          return true;
        }
      } else {
        // react-native-webview instance
        const nativeRef = inner as ReactNativeWebView;
        if (canGoBack) {
          nativeRef.goBack?.();
          return true;
        }
      }
    } catch {
      // ignore — fall through to navigation.goBack()
    }
    return false;
  }, [canGoBack, webviewRef]);

  // ----------------------------------------------------------------------
  // Back handler — Android hardware back / desktop Esc / web Esc.
  // Prefer in-page back; fall back to closing the overlay.
  // ----------------------------------------------------------------------
  const onBackHandler = useCallback(() => {
    if (handleWebViewGoBack()) {
      return true;
    }
    if (navigation.canGoBack()) {
      navigation.goBack();
    }
    return true;
  }, [handleWebViewGoBack, navigation]);

  useBackHandler(onBackHandler, true);

  // ----------------------------------------------------------------------
  // Sidebar tab close listener (desktop only). When the root route stack
  // settles back on Main (sidebar tap), close ourselves so the tap takes
  // visual effect. The re-entrancy guard prevents a second goBack() when
  // our own goBack() triggers another router-state event before unmount.
  // ----------------------------------------------------------------------
  useOnRouterChange((state) => {
    if (!platformEnv.isDesktop) return;
    if (isClosingRef.current) return;
    if (!state) return;
    const top = state.routes?.[state.index ?? 0];
    if (top?.name === ERootRoutes.Main && navigation.canGoBack?.()) {
      isClosingRef.current = true;
      navigation.goBack();
    }
  });

  // ----------------------------------------------------------------------
  // Browser history write-through. The first effect writes immediately on
  // URL change (with whatever title is currently buffered in the ref). The
  // second effect re-writes the same URL when the title arrives later —
  // addBrowserHistory replaces existing entries by URL (actions.ts: filter
  // by url, then prepend), so the second write swaps the empty-title entry.
  // ----------------------------------------------------------------------
  useEffect(() => {
    if (!currentUrl) return;
    if (currentUrl === lastHistoryUrlRef.current) return;
    lastHistoryUrlRef.current = currentUrl;
    void addBrowserHistory({
      url: currentUrl,
      title: currentTitleRef.current,
      logo: undefined,
    });
  }, [addBrowserHistory, currentUrl]);

  useEffect(() => {
    if (!currentUrl || !currentTitle) return;
    if (currentUrl !== lastHistoryUrlRef.current) return;
    void addBrowserHistory({
      url: currentUrl,
      title: currentTitle,
      logo: undefined,
    });
  }, [addBrowserHistory, currentTitle, currentUrl]);

  // Stop loading on unmount to avoid native crashes (mirrors WebViewModal).
  // We must read webviewRef.current at cleanup time — capturing it at mount
  // is always null because the WebView ref is populated via onWebViewRef
  // after the first render. The exhaustive-deps rule's "ref.current likely
  // changed by cleanup" note is exactly the behavior we want here.
  useEffect(() => {
    return () => {
      try {
        // eslint-disable-next-line react-hooks/exhaustive-deps
        const inner = webviewRef.current?.innerRef as
          | { stopLoading?: () => void }
          | undefined;
        inner?.stopLoading?.();
      } catch {
        // ignore — native resources may already be freed
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Desktop popup + main-process pre-nav-guard registration — implemented
  // in `useOverlayDesktopPopup.desktop.ts`; a no-op on native/web. Keeps
  // this page free of `apps/desktop` imports.
  useOverlayDesktopPopup({ webContentsId: desktopContentsId });

  const onWebViewRef = useCallback(
    (ref: Parameters<typeof setWebViewRef>[0] | null) => {
      if (ref) setWebViewRef(ref);
    },
    [setWebViewRef],
  );

  // Per-navigation URL safety guard. Called by react-native-webview before
  // each main-frame load (clicks, redirects, JS pushState, etc.). Blocks any
  // navigation whose target violates the WebView URL policy (non-https, local
  // address, userinfo embed, javascript: bookmarklets injected via redirects).
  // Iframe loads (`event.isTopFrame === false`) are passed through — those
  // are the page's own composition, not user-visible navigation.
  const onShouldStartLoadWithRequest = useCallback(
    (event: ShouldStartLoadRequest): boolean => {
      if (event?.isTopFrame === false) return true;
      return isAllowedWebViewUrl(event?.url);
    },
    [],
  );

  // Popup safety guard. `onShouldStartLoadWithRequest` only fires for the
  // main WebView's own navigation; popups opened via `window.open` or
  // `target=_blank` go through a separate code path (native: onOpenWindow,
  // Electron: new-window event) that bypasses the per-navigation check.
  // Without this handler, a page that passed the initial https/local-host
  // gate could then call `window.open('javascript:…')` or
  // `window.open('https://127.0.0.1/')` and escape the policy. We run the
  // same `isAllowedWebViewUrl` here and route allowed popups to the system
  // browser (matching normal `_blank` semantics).
  const onOpenWindow = useCallback((event: WebViewOpenWindowEvent) => {
    const targetUrl = event?.nativeEvent?.targetUrl;
    if (!isAllowedWebViewUrl(targetUrl)) return;
    openUrlExternal(targetUrl);
  }, []);

  // External entries (deeplink / notification) cannot suppress the header,
  // pass a caller-supplied title, or hide the address bar — those params are
  // untrusted and would otherwise enable header / title spoofing of any
  // https page. See `resolveOverlayDisplay` for the rule.
  const display = useMemo(
    () =>
      resolveOverlayDisplay({
        source: params.source,
        title: params.title,
        hideHeader: params.hideHeader,
        showAddressBar: params.showAddressBar,
      }),
    [params.source, params.title, params.hideHeader, params.showAddressBar],
  );

  const showAddressBar = display.showAddressBar;

  const headerNode = useMemo(
    () => (
      <WebViewHeader
        url={currentUrl}
        title={currentTitle}
        fallbackTitle={display.fallbackTitle}
        hidden={display.hideHeader}
        onReload={handleReload}
      />
    ),
    [
      currentTitle,
      currentUrl,
      display.fallbackTitle,
      display.hideHeader,
      handleReload,
    ],
  );

  // Desktop: render the body as a rounded card so its top edge curves out of
  // the sidebar-colored wrapper underneath (set in createWebViewNavigator).
  // `overflow: hidden` clips the embedded WebView to those corners.
  const bodyDesktopProps = platformEnv.isDesktop
    ? ({
        bg: '$bgApp',
        borderTopStartRadius: '$3',
        borderTopEndRadius: '$3',
        overflow: 'hidden',
      } as const)
    : undefined;

  return (
    <Page>
      {headerNode}
      <Page.Body {...bodyDesktopProps}>
        {showAddressBar ? <AddressBar url={currentUrl} /> : null}
        <ProgressBar progress={progress} />
        <WebView
          src={initialUrl}
          onWebViewRef={onWebViewRef}
          onProgress={setProgress}
          onNavigationStateChange={onNavigationStateChange}
          onDidStartNavigation={onDidStartNavigation}
          onPageTitleUpdated={onPageTitleUpdated}
          onDidFinishLoad={onDidFinishLoad}
          onDidStopLoading={onDidFinishLoad}
          onDidFailLoad={onDidFinishLoad}
          onShouldStartLoadWithRequest={onShouldStartLoadWithRequest}
          onOpenWindow={onOpenWindow}
          allowpopups
          disableBridge
          mediaPermissionWhitelist={OVERLAY_NO_MEDIA_WHITELIST}
          useInjectedNativeCode={false}
        />
      </Page.Body>
    </Page>
  );
}

export default function WebViewPage() {
  return (
    <DiscoveryBrowserProviderMirror>
      <WebViewPageContent />
    </DiscoveryBrowserProviderMirror>
  );
}
