import { useCallback, useEffect, useState } from 'react';

import { useWebViewBridge } from '@onekeyfe/onekey-cross-webview';
import { useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';
import { Share } from 'react-native';

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
  const { url, title, isWebEmbed, hashRoutePath, hashRouteQueryParams } =
    route.params;
  const navigation = useAppNavigation();

  const { copyText } = useClipboard();
  const intl = useIntl();

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
                  webviewRef?.current?.reload?.();
                },
              },
              {
                label: intl.formatMessage({ id: ETranslations.explore_share }),
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
              },
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
            ],
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
  return (
    <Page>
      <Page.Header headerRight={headerRight} title={navigationTitle} />
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
            onNavigationStateChange={onNavigationStateChange}
          />
        )}
      </Page.Body>
    </Page>
  );
}
