import type { ComponentType } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useWebViewBridge } from '@onekeyfe/onekey-cross-webview';
import { useIsFocused, useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';
import { Share } from 'react-native';

import type { IActionListItemProps } from '@onekeyhq/components';
import {
  ActionList,
  Page,
  Toast,
  YStack,
  useClipboard,
} from '@onekeyhq/components';
import { LazyPopover } from '@onekeyhq/components/src/actions/LazyPopover';
import { HeaderIconButton } from '@onekeyhq/components/src/layouts/Navigation/Header';
import WebView, {
  type IWebViewProps,
} from '@onekeyhq/kit/src/components/WebView';
import IsolatedWebView from '@onekeyhq/kit/src/components/WebView/IsolatedWebView';
import type { IElectronWebView } from '@onekeyhq/kit/src/components/WebView/types';
import { WebViewWithFeatures } from '@onekeyhq/kit/src/components/WebView/WebViewWithFeatures';
import { WebViewWebEmbed } from '@onekeyhq/kit/src/components/WebViewWebEmbed';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useCrossDomainRedirect } from '@onekeyhq/kit/src/hooks/useCrossDomainRedirect';
import { handleDeepLinkUrl } from '@onekeyhq/kit/src/routes/config/deeplink';
import { handlePrimeHostedCardCheckoutFallbackRequest } from '@onekeyhq/kit/src/views/Prime/hooks/primeHostedCardCheckout';
import { handlePrimePurchaseSuccessCloseRequest } from '@onekeyhq/kit/src/views/Prime/primeSubscriptionPurchaseSuccess';
import { useDevSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms/devSettings';
import { useAppIsLockedAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms/passwordLock';
import { usePrimePersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms/prime';
import { useSettingsFiatPaySiteWhitelistPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms/settings';
import {
  EWebEmbedPrivateRequestMethod,
  EWebEmbedRoutePath,
} from '@onekeyhq/shared/src/consts/webEmbedConsts';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import {
  createIntercomSessionScript,
  isIntercomNativeHandshake,
  resolveIntercomSupportOrigin,
} from '@onekeyhq/shared/src/modules3rdParty/intercom/bridge';
import { getIntercomSessionToken } from '@onekeyhq/shared/src/modules3rdParty/intercom/identity';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { isPrimeStoreOnlyPayment } from '@onekeyhq/shared/src/prime/primePaymentCapabilities';
import type {
  EModalWebViewRoutes,
  IModalWebViewParamList,
} from '@onekeyhq/shared/src/routes/webView';
import { openUrlExternal } from '@onekeyhq/shared/src/utils/openUrlUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import uriUtils from '@onekeyhq/shared/src/utils/uriUtils';

import { WebViewTestIDs } from '../../testIDs';
import {
  EDappWebViewNavigationDecision,
  resolveDappWebViewNavigation,
} from '../../utils/dappWebViewNavigationPolicy';
import { shouldHideWebViewHeaderRight } from '../../utils/displayPolicy';

import { IntercomSupportFrame } from './IntercomSupportFrame';

import type {
  IJsBridgeMessagePayload,
  IJsonRpcRequest,
} from '@onekeyfe/cross-inpage-provider-types';
import type { RouteProp } from '@react-navigation/core';
import type {
  WebView as IReactNativeWebView,
  WebViewMessageEvent,
} from 'react-native-webview';

const PRIME_CHECKOUT_MENU_CONTENT_PROPS = {
  p: '$1',
  $md: { p: '$3', pt: '$0' },
} as const;
const PRIME_CHECKOUT_MENU_PANEL_PROPS = { width: '$56' } as const;

export default function WebViewModal() {
  const { webviewRef, setWebViewRef } = useWebViewBridge();
  const route =
    useRoute<RouteProp<IModalWebViewParamList, EModalWebViewRoutes.WebView>>();
  const {
    url,
    title,
    isWebEmbed,
    hashRoutePath,
    hashRouteQueryParams,
    redirectExternalNavigation,
    hideHeaderRight,
    enableDappBridge,
    disableBridge,
    intercomUserId,
    intercomConversationId,
  } = route.params;
  const navigation = useAppNavigation();
  const isFocused = useIsFocused();
  const [isLocked] = useAppIsLockedAtom();
  const [{ isLoggedIn, onekeyUserId }] = usePrimePersistAtom();
  const [devSettings] = useDevSettingsPersistAtom();
  // Follows the developer support URL override, so the session is only handed
  // to the page the support entry was configured to open.
  const supportOrigin = resolveIntercomSupportOrigin(devSettings);
  const supportSessionClosed = useRef(false);
  const supportDismissed = useRef(false);
  if (
    intercomUserId !== undefined &&
    (isLocked || (isLoggedIn ? onekeyUserId : null) !== intercomUserId)
  ) {
    supportSessionClosed.current = true;
  }
  const shouldCloseSupport = supportSessionClosed.current;
  useEffect(() => {
    if (shouldCloseSupport && isFocused && !supportDismissed.current) {
      supportDismissed.current = true;
      navigation.pop();
    }
  }, [isFocused, navigation, shouldCloseSupport]);

  const { copyText } = useClipboard();
  const intl = useIntl();
  const isPrimeCheckout = Boolean(
    (platformEnv.isNativeAndroid || platformEnv.isDesktop) &&
    !isPrimeStoreOnlyPayment() &&
    isWebEmbed &&
    hashRoutePath === EWebEmbedRoutePath.primePurchase,
  );
  const [{ fiatPaySiteWhitelist }] =
    useSettingsFiatPaySiteWhitelistPersistAtom();

  // Track if component is unmounting to prevent race conditions
  const isUnmounting = useRef(false);
  const [primeCheckoutMenuOpen, setPrimeCheckoutMenuOpen] = useState(false);
  const closePrimeCheckoutMenu = useCallback(() => {
    if (!isUnmounting.current) {
      setPrimeCheckoutMenuOpen(false);
    }
  }, []);
  const onPrimeCheckoutMenuOpenChange = useCallback((open: boolean) => {
    if (!isUnmounting.current) {
      setPrimeCheckoutMenuOpen(open);
    }
  }, []);
  const popWebView = useCallback(() => {
    closePrimeCheckoutMenu();
    // Header callbacks become stale as soon as this route starts closing.
    isUnmounting.current = true;
    navigation.pop();
  }, [closePrimeCheckoutMenu, navigation]);

  const deliverSupportSession = useCallback(async () => {
    if (intercomUserId === undefined) {
      return;
    }
    try {
      const token = await getIntercomSessionToken(intercomUserId);
      // A lock or account switch during the request already closed support.
      if (isUnmounting.current || supportSessionClosed.current) {
        return;
      }
      const webview = webviewRef?.current?.innerRef as
        | IReactNativeWebView
        | undefined;
      webview?.injectJavaScript(
        createIntercomSessionScript(
          token,
          supportOrigin,
          intercomConversationId,
        ),
      );
    } catch {
      // The hosted page times out and offers a retry rather than opening
      // support without the session the user expects.
      console.warn('Failed to deliver Intercom session');
    }
  }, [intercomConversationId, intercomUserId, supportOrigin, webviewRef]);

  // Desktop guests cannot post a handshake to the host (no RN message bridge
  // and no extension MessageChannel), so the host injects the same session
  // script into the loaded page instead. The hosted page can attach its
  // listener after dom-ready, so retry a few times while the modal is open.
  const desktopSupportTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const desktopSupportGeneration = useRef(0);
  const deliverDesktopSupportSession = useCallback(() => {
    if (!platformEnv.isDesktop || intercomUserId === undefined) {
      return;
    }
    if (desktopSupportTimer.current) {
      clearTimeout(desktopSupportTimer.current);
      desktopSupportTimer.current = undefined;
    }
    desktopSupportGeneration.current += 1;
    const generation = desktopSupportGeneration.current;
    void (async () => {
      const token = await getIntercomSessionToken(intercomUserId);
      if (
        isUnmounting.current ||
        supportSessionClosed.current ||
        desktopSupportGeneration.current !== generation
      ) {
        return;
      }
      const script = createIntercomSessionScript(
        token,
        supportOrigin,
        intercomConversationId,
      );
      let attempts = 0;
      const inject = () => {
        const webview = webviewRef?.current?.innerRef as
          | IElectronWebView
          | undefined;
        webview?.executeJavaScript(script);
      };
      const retry = () => {
        if (
          isUnmounting.current ||
          supportSessionClosed.current ||
          desktopSupportGeneration.current !== generation
        ) {
          return;
        }
        inject();
        if (attempts >= 3) {
          return;
        }
        attempts += 1;
        desktopSupportTimer.current = setTimeout(retry, 800 * attempts);
      };
      retry();
    })().catch(() => {
      // The hosted page times out and offers a retry rather than opening
      // support without the session the user expects.
      console.warn('Failed to deliver Intercom session');
    });
  }, [intercomConversationId, intercomUserId, supportOrigin, webviewRef]);
  useEffect(
    () => () => {
      if (desktopSupportTimer.current) {
        clearTimeout(desktopSupportTimer.current);
      }
    },
    [],
  );

  const onSupportMessage = useCallback(
    ({ nativeEvent }: WebViewMessageEvent) => {
      if (isIntercomNativeHandshake(nativeEvent, supportOrigin)) {
        void deliverSupportSession();
      }
    },
    [deliverSupportSession, supportOrigin],
  );

  // Cleanup WebView before unmount to prevent native crashes
  useEffect(() => {
    isUnmounting.current = false;
    // Capture webview ref in effect scope to satisfy exhaustive-deps
    const webview = webviewRef?.current;

    return () => {
      isUnmounting.current = true;

      try {
        // Stop loading WebView before unmount to prevent race conditions
        // Access stopLoading through innerRef as it's not exposed in the wrapper
        const innerWebView = webview?.innerRef;
        if (innerWebView && 'stopLoading' in innerWebView) {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-call
          (innerWebView as any).stopLoading?.();
        }
      } catch (error) {
        // Ignore errors during cleanup - native resources may already be freed
        console.log('WebView cleanup error:', error);
      }
    };
  }, [webviewRef]);

  // Track current URL to handle in-page navigation changes
  const [currentUrl, setCurrentUrl] = useState(url);
  const headerRight = useCallback(
    () => (
      <ActionList
        renderTrigger={
          <HeaderIconButton
            icon="DotHorOutline"
            testID={WebViewTestIDs.optionsMenuBtn}
          />
        }
        title={intl.formatMessage({ id: ETranslations.explore_options })}
        sections={[
          {
            items: [
              {
                label: intl.formatMessage({ id: ETranslations.global_refresh }),
                icon: 'RefreshCwOutline',
                testID: WebViewTestIDs.refreshBtn,
                onPress: async () => {
                  if (isUnmounting.current) return;
                  webviewRef?.current?.reload?.();
                },
              },
              platformEnv.isNative
                ? {
                    label: intl.formatMessage({
                      id: ETranslations.explore_share,
                    }),
                    icon: 'ShareOutline',
                    testID: WebViewTestIDs.shareBtn,
                    onPress: () => {
                      Share.share(
                        platformEnv.isNativeIOS
                          ? {
                              url: currentUrl,
                            }
                          : {
                              message: currentUrl,
                            },
                      ).catch(() => {});
                    },
                  }
                : undefined,
              {
                // 'Copy URL'
                label: intl.formatMessage({
                  id: ETranslations.global_copy_url,
                }),
                icon: 'LinkOutline',
                testID: WebViewTestIDs.copyUrlBtn,
                onPress: async () => {
                  copyText(currentUrl);
                },
              },
              {
                label: intl.formatMessage({
                  id: ETranslations.explore_open_in_browser,
                }),
                icon: 'GlobusOutline',
                testID: WebViewTestIDs.openInBrowserBtn,
                onPress: async () => {
                  // Explicit "open in browser" action: leave the app.
                  openUrlExternal(currentUrl, { useSystemBrowser: true });
                },
              },
            ].filter(Boolean) as IActionListItemProps[],
          },
        ]}
      />
    ),
    [webviewRef, currentUrl, copyText, intl],
  );

  const [navigationTitle, setNavigationTitle] = useState(title);
  useEffect(() => {
    // A dApp page can ask to connect before it reports a document title, so
    // fall back to the host: the user must be able to see which site is asking.
    setNavigationTitle(
      enableDappBridge ? uriUtils.getHostNameFromUrl({ url }) : '',
    );
    // Runs once on mount, same as before.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // Desktop never emits onNavigationStateChange (the Electron adapter only
  // forwards onDidStartNavigation), so the live-origin header and the dApp
  // notification target would keep the entry host there. Feed both platforms
  // through the same updater.
  const onDesktopDidStartNavigation = useCallback(
    ({ url: nextUrl, isMainFrame }: { url: string; isMainFrame: boolean }) => {
      if (isUnmounting.current || !isMainFrame || !nextUrl) return;
      setCurrentUrl(nextUrl);
      if (enableDappBridge) {
        setNavigationTitle(uriUtils.getHostNameFromUrl({ url: nextUrl }));
      }
    },
    [enableDappBridge],
  );

  const onNavigationStateChange = useCallback(
    ({ title: webTitle, url: newUrl }: { title: string; url?: string }) => {
      // Guard against events after unmount started
      if (isUnmounting.current) return;

      if (enableDappBridge) {
        // Never show the page's own document.title in a dApp session: it is
        // attacker-controlled chrome right where the user decides whether to
        // connect. Track the live URL instead, so a cross-origin hop is visible.
        setNavigationTitle(
          uriUtils.getHostNameFromUrl({ url: newUrl || currentUrl || url }),
        );
      } else if (!title) {
        setNavigationTitle(webTitle);
      }
      // Update current URL when navigation occurs
      if (newUrl) {
        setCurrentUrl(newUrl);
      }
    },
    [enableDappBridge, currentUrl, url, title, setNavigationTitle],
  );
  const openPrimeHostedCheckout = useCallback(
    async (params: unknown) => {
      if (isUnmounting.current) return;
      popWebView();
      // Let the WebView modal close before the checkout dialogs show.
      await timerUtils.wait(350);
      await handlePrimeHostedCardCheckoutFallbackRequest({
        params,
        routePrimeUserId: hashRouteQueryParams?.primeUserId,
        routePrimeUserEmail: hashRouteQueryParams?.primeUserEmail,
        routeSubscriptionPeriod: hashRouteQueryParams?.subscriptionPeriod,
        routeCurrency: hashRouteQueryParams?.currency,
        intl,
      });
    },
    [popWebView, hashRouteQueryParams, intl],
  );
  const webembedCustomReceiveHandler = useCallback(
    (payload: IJsBridgeMessagePayload) => {
      // Guard against events after unmount started and pin strictly to the
      // Prime purchase web-embed route and $private scope.
      if (
        isUnmounting.current ||
        !isWebEmbed ||
        hashRoutePath !== EWebEmbedRoutePath.primePurchase ||
        (payload.scope !== undefined && payload.scope !== '$private')
      ) {
        return;
      }

      const data = payload.data as IJsonRpcRequest | undefined;
      if (!data) {
        return;
      }
      if (data.method === EWebEmbedPrivateRequestMethod.closeWebViewModal) {
        popWebView();
      }
      if (
        data.method ===
        EWebEmbedPrivateRequestMethod.closeWebViewModalAfterPrimePurchaseSuccess
      ) {
        handlePrimePurchaseSuccessCloseRequest({
          params: data.params,
          hashRoutePath,
          routePrimeUserId: hashRouteQueryParams?.primeUserId,
          isWebEmbed,
          pop: popWebView,
        });
      }
      if (
        data.method ===
        EWebEmbedPrivateRequestMethod.fallbackToPrimeHostedCheckout
      ) {
        void openPrimeHostedCheckout(data.params);
      }
      if (data.method === EWebEmbedPrivateRequestMethod.showToast) {
        const toastParams = data.params as
          | {
              title: string;
              message: string;
            }
          | undefined;
        Toast.message({
          title: toastParams?.title || '',
          message: toastParams?.message || '',
        });
      }
    },
    [
      hashRoutePath,
      hashRouteQueryParams?.primeUserId,
      isWebEmbed,
      openPrimeHostedCheckout,
      popWebView,
    ],
  );

  const openPrimeHostedCheckoutFromMenu = useCallback(() => {
    void openPrimeHostedCheckout({
      trigger: 'userRequestedHostedCheckout',
      onekeyUserId: hashRouteQueryParams?.primeUserId,
      subscriptionPeriod: hashRouteQueryParams?.subscriptionPeriod,
      featureName: hashRouteQueryParams?.featureName,
    });
  }, [openPrimeHostedCheckout, hashRouteQueryParams]);
  const renderPrimeCheckoutMenu = useCallback(
    () => (
      <YStack {...PRIME_CHECKOUT_MENU_CONTENT_PROPS}>
        <ActionList.Item
          label={intl.formatMessage({
            id: ETranslations.explore_open_in_browser,
          })}
          icon="GlobusOutline"
          testID={WebViewTestIDs.openInBrowserBtn}
          onPress={openPrimeHostedCheckoutFromMenu}
          onClose={closePrimeCheckoutMenu}
        />
      </YStack>
    ),
    [intl, openPrimeHostedCheckoutFromMenu, closePrimeCheckoutMenu],
  );
  const primeCheckoutHeaderRight = useCallback(
    () => (
      <LazyPopover
        title={intl.formatMessage({ id: ETranslations.explore_options })}
        open={primeCheckoutMenuOpen}
        onOpenChange={onPrimeCheckoutMenuOpenChange}
        renderContent={renderPrimeCheckoutMenu}
        floatingPanelProps={PRIME_CHECKOUT_MENU_PANEL_PROPS}
        renderTrigger={
          <HeaderIconButton
            icon="DotHorOutline"
            testID={WebViewTestIDs.optionsMenuBtn}
            accessibilityLabel={intl.formatMessage({
              id: ETranslations.explore_options,
            })}
          />
        }
      />
    ),
    [
      intl,
      primeCheckoutMenuOpen,
      onPrimeCheckoutMenuOpenChange,
      renderPrimeCheckoutMenu,
    ],
  );

  const { onShouldStartLoadWithRequest, onOpenWindow } = useCrossDomainRedirect(
    url,
    !!redirectExternalNavigation,
  );

  // The entry URL was checked once before this modal opened, but the page can
  // navigate the top frame anywhere while keeping the wallet bridge, so every
  // navigation is re-checked here — the same guard the Discovery browser runs.
  const onDappShouldStartLoadWithRequest = useCallback(
    ({ url: navUrl, isTopFrame }: { url: string; isTopFrame?: boolean }) => {
      const decision = resolveDappWebViewNavigation({
        url: navUrl,
        isTopFrame,
      });
      if (decision === EDappWebViewNavigationDecision.Deeplink) {
        handleDeepLinkUrl({ url: navUrl });
        return false;
      }
      if (decision === EDappWebViewNavigationDecision.Deny) {
        defaultLogger.discovery.browser.logRejectUrl(navUrl);
        return false;
      }
      return true;
    },
    [],
  );

  const shouldStartLoadWithRequestHandler = useMemo(() => {
    if (enableDappBridge) {
      return onDappShouldStartLoadWithRequest;
    }
    return redirectExternalNavigation
      ? onShouldStartLoadWithRequest
      : undefined;
  }, [
    enableDappBridge,
    onDappShouldStartLoadWithRequest,
    onShouldStartLoadWithRequest,
    redirectExternalNavigation,
  ]);

  // Bridge-disabled pages (e.g. Intercom Support) use IsolatedWebView so they
  // never load the dApp preload or compete for the shared background bridge.
  let WebViewComponent: ComponentType<IWebViewProps> = WebView;
  if (disableBridge) {
    WebViewComponent = IsolatedWebView;
  } else if (enableDappBridge) {
    WebViewComponent = WebViewWithFeatures;
  }
  const defaultHeaderRight = shouldHideWebViewHeaderRight({
    url: currentUrl,
    isWebEmbed,
    hideHeaderRight,
  })
    ? undefined
    : headerRight;

  // Unmount immediately even when another modal covers this route. Only pop
  // when focused, so an unrelated modal is never dismissed in its place.
  if (shouldCloseSupport) {
    return null;
  }

  const extensionSupportFrame =
    platformEnv.isExtension && intercomUserId !== undefined ? (
      <IntercomSupportFrame
        url={url}
        userId={intercomUserId}
        supportOrigin={supportOrigin}
      />
    ) : null;

  return (
    <Page>
      <Page.Header
        headerRight={
          isPrimeCheckout && !hideHeaderRight
            ? primeCheckoutHeaderRight
            : defaultHeaderRight
        }
        title={navigationTitle}
      />
      <Page.Body>
        {isWebEmbed ? (
          <WebViewWebEmbed
            hashRoutePath={hashRoutePath}
            hashRouteQueryParams={hashRouteQueryParams}
            customReceiveHandler={webembedCustomReceiveHandler}
          />
        ) : (
          (extensionSupportFrame ?? (
            <WebViewComponent
              disableBridge={disableBridge}
              onWebViewRef={(ref) => ref && setWebViewRef(ref)}
              onDomReady={
                platformEnv.isDesktop && intercomUserId !== undefined
                  ? deliverDesktopSupportSession
                  : undefined
              }
              src={url}
              mediaPermissionWhitelist={fiatPaySiteWhitelist}
              allowpopups={!!redirectExternalNavigation}
              onNavigationStateChange={onNavigationStateChange}
              onDidStartNavigation={onDesktopDidStartNavigation}
              onShouldStartLoadWithRequest={shouldStartLoadWithRequestHandler}
              onOpenWindow={
                redirectExternalNavigation ? onOpenWindow : undefined
              }
              onMessage={
                platformEnv.isNative && intercomUserId !== undefined
                  ? onSupportMessage
                  : undefined
              }
              {...(enableDappBridge
                ? // important: without this the dApp is never told about the
                  // connected account, so it stays disconnected after the user
                  // approves (see PageWebviewPerpTrade). currentUrl keeps those
                  // notifications addressed to the page that is actually loaded
                  // after a cross-origin hop, without reloading the WebView.
                  {
                    features: { notifyChangedEventsToDappOnFocus: true },
                    currentUrl,
                  }
                : undefined)}
            />
          ))
        )}
      </Page.Body>
    </Page>
  );
}
