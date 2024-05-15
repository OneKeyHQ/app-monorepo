import { useCallback, useState } from 'react';

import { useWebViewBridge } from '@onekeyfe/onekey-cross-webview';
import { useRoute } from '@react-navigation/core';
import { Share } from 'react-native';

import { ActionList, Page, useClipboard } from '@onekeyhq/components';
import { HeaderIconButton } from '@onekeyhq/components/src/layouts/Navigation/Header';
import WebView from '@onekeyhq/kit/src/components/WebView';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type {
  EModalWebViewRoutes,
  IModalWebViewParamList,
} from '@onekeyhq/shared/src/routes/webView';
import { openUrlExternal } from '@onekeyhq/shared/src/utils/openUrlUtils';

import type { RouteProp } from '@react-navigation/core';

export default function WebViewModal() {
  const { webviewRef, setWebViewRef } = useWebViewBridge();
  const route =
    useRoute<RouteProp<IModalWebViewParamList, EModalWebViewRoutes.WebView>>();
  const { url, title } = route.params;
  const { copyText } = useClipboard();
  const headerRight = useCallback(
    () => (
      <ActionList
        renderTrigger={<HeaderIconButton icon="DotHorOutline" />}
        title="Options"
        sections={[
          {
            items: [
              {
                label: 'Refresh',
                icon: 'RefreshCwOutline',
                onPress: async () => {
                  webviewRef?.current?.reload?.();
                },
              },
              {
                label: 'Share',
                icon: 'ShareOutline',
                onPress: () => {
                  Share.share(
                    platformEnv.isNativeIOS
                      ? {
                          url,
                        }
                      : {
                          message: url,
                        },
                  ).catch(() => {});
                },
              },
              {
                label: 'Copy URL',
                icon: 'LinkOutline',
                onPress: async () => {
                  copyText(url);
                },
              },
              {
                label: 'Open in Browser',
                icon: 'GlobusOutline',
                onPress: async () => {
                  openUrlExternal(url);
                },
              },
            ],
          },
        ]}
      />
    ),
    [webviewRef, url, copyText],
  );

  const [navigationTitle, setNavigationTitle] = useState(title);
  const onNavigationStateChange = useCallback(
    ({ title: webTitle }: { title: string }) => {
      if (!title) {
        setNavigationTitle(webTitle);
      }
    },
    [title, setNavigationTitle],
  );
  return (
    <Page>
      <Page.Header headerRight={headerRight} title={navigationTitle} />
      <Page.Body>
        <WebView
          onWebViewRef={(ref) => ref && setWebViewRef(ref)}
          src={url}
          onNavigationStateChange={onNavigationStateChange}
        />
      </Page.Body>
    </Page>
  );
}
