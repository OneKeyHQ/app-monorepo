import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useWebViewBridge } from '@onekeyfe/onekey-cross-webview';
import { useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';
import { Share } from 'react-native';

import type { IActionListItemProps } from '@onekeyhq/components';
import {
  ActionList,
  Dialog,
  Page,
  Toast,
  useClipboard,
} from '@onekeyhq/components';
import { HeaderIconButton } from '@onekeyhq/components/src/layouts/Navigation/Header';
import WebView from '@onekeyhq/kit/src/components/WebView';
import { WebViewWithFeatures } from '@onekeyhq/kit/src/components/WebView/WebViewWithFeatures';
import { WebViewWebEmbed } from '@onekeyhq/kit/src/components/WebViewWebEmbed';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useCrossDomainRedirect } from '@onekeyhq/kit/src/hooks/useCrossDomainRedirect';
import { handleDeepLinkUrl } from '@onekeyhq/kit/src/routes/config/deeplink';
import { useSettingsFiatPaySiteWhitelistPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms/settings';
import { EWebEmbedPrivateRequestMethod } from '@onekeyhq/shared/src/consts/webEmbedConsts';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type {
  EModalWebViewRoutes,
  IModalWebViewParamList,
} from '@onekeyhq/shared/src/routes/webView';
import { openUrlExternal } from '@onekeyhq/shared/src/utils/openUrlUtils';
import uriUtils from '@onekeyhq/shared/src/utils/uriUtils';

import { WebViewTestIDs } from '../../testIDs';
import {
  EDappWebViewNavigationDecision,
  resolveDappWebViewNavigation,
} from '../../utils/dappWebViewNavigationPolicy';

import type {
  IJsBridgeMessagePayload,
  IJsonRpcRequest,
} from '@onekeyfe/cross-inpage-provider-types';
import type { RouteProp } from '@react-navigation/core';

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
  } = route.params;
  const navigation = useAppNavigation();

  const { copyText } = useClipboard();
  const intl = useIntl();
  const [{ fiatPaySiteWhitelist }] =
    useSettingsFiatPaySiteWhitelistPersistAtom();

  // Track if component is unmounting to prevent race conditions
  const isUnmounting = useRef(false);

  // Cleanup WebView before unmount to prevent native crashes
  useEffect(() => {
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
                  openUrlExternal(currentUrl);
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
  const webembedCustomReceiveHandler = useCallback(
    (payload: IJsBridgeMessagePayload) => {
      // Guard against events after unmount started
      if (isUnmounting.current) return;

      const data = payload.data as IJsonRpcRequest;
      if (data.method === EWebEmbedPrivateRequestMethod.closeWebViewModal) {
        navigation.pop();
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
      if (
        platformEnv.isDev &&
        data.method === EWebEmbedPrivateRequestMethod.showDebugMessageDialog
      ) {
        const debugMessageDialogParams = data.params;
        Dialog.debugMessage({
          debugMessage: debugMessageDialogParams,
        });
      }
    },
    [navigation],
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

  // Same inpage provider either way; the wrapper only adds the account/network
  // change notifications a live dApp session needs.
  const WebViewComponent = enableDappBridge ? WebViewWithFeatures : WebView;

  return (
    <Page>
      <Page.Header
        headerRight={hideHeaderRight ? undefined : headerRight}
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
          <WebViewComponent
            onWebViewRef={(ref) => ref && setWebViewRef(ref)}
            src={url}
            mediaPermissionWhitelist={fiatPaySiteWhitelist}
            allowpopups={!!redirectExternalNavigation}
            onNavigationStateChange={onNavigationStateChange}
            onDidStartNavigation={onDesktopDidStartNavigation}
            onShouldStartLoadWithRequest={shouldStartLoadWithRequestHandler}
            onOpenWindow={redirectExternalNavigation ? onOpenWindow : undefined}
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
        )}
      </Page.Body>
    </Page>
  );
}
