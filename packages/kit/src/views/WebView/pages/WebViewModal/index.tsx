import { useCallback, useEffect, useRef, useState } from 'react';

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
import { WebViewWebEmbed } from '@onekeyhq/kit/src/components/WebViewWebEmbed';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useCrossDomainRedirect } from '@onekeyhq/kit/src/hooks/useCrossDomainRedirect';
import { useSettingsFiatPaySiteWhitelistPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms/settings';
import { EWebEmbedPrivateRequestMethod } from '@onekeyhq/shared/src/consts/webEmbedConsts';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type {
  EModalWebViewRoutes,
  IModalWebViewParamList,
} from '@onekeyhq/shared/src/routes/webView';
import { openUrlExternal } from '@onekeyhq/shared/src/utils/openUrlUtils';

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
        renderTrigger={<HeaderIconButton icon="DotHorOutline" />}
        title={intl.formatMessage({ id: ETranslations.explore_options })}
        sections={[
          {
            items: [
              {
                label: intl.formatMessage({ id: ETranslations.global_refresh }),
                icon: 'RefreshCwOutline',
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
                onPress: async () => {
                  copyText(currentUrl);
                },
              },
              {
                label: intl.formatMessage({
                  id: ETranslations.explore_open_in_browser,
                }),
                icon: 'GlobusOutline',
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
    setNavigationTitle('');
  }, []);
  const onNavigationStateChange = useCallback(
    ({ title: webTitle, url: newUrl }: { title: string; url?: string }) => {
      // Guard against events after unmount started
      if (isUnmounting.current) return;

      if (!title) {
        setNavigationTitle(webTitle);
      }
      // Update current URL when navigation occurs
      if (newUrl) {
        setCurrentUrl(newUrl);
      }
    },
    [title, setNavigationTitle],
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
          <WebView
            onWebViewRef={(ref) => ref && setWebViewRef(ref)}
            src={url}
            mediaPermissionWhitelist={fiatPaySiteWhitelist}
            allowpopups={!!redirectExternalNavigation}
            onNavigationStateChange={onNavigationStateChange}
            onShouldStartLoadWithRequest={
              redirectExternalNavigation
                ? onShouldStartLoadWithRequest
                : undefined
            }
            onOpenWindow={redirectExternalNavigation ? onOpenWindow : undefined}
          />
        )}
      </Page.Body>
    </Page>
  );
}
