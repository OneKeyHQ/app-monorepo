import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { SizableText, Stack, View, XStack } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src//background/instance/backgroundApiProxy';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import webEmbedConfig from '@onekeyhq/shared/src/storage/webEmbedConfig';

import WebView from '../WebView';

import type { IJsBridgeReceiveHandler } from '@onekeyfe/cross-inpage-provider-types';
import type { IWebViewWrapperRef } from '@onekeyfe/onekey-cross-webview';

const initTop = '15%';
// /onboarding/auto_typing
export function WebViewWebEmbed({
  isSingleton,
  customReceiveHandler,
}: {
  isSingleton?: boolean;
  customReceiveHandler?: IJsBridgeReceiveHandler;
}) {
  const webviewRef = useRef<IWebViewWrapperRef | null>(null);
  const onWebViewRef = useCallback(($ref: IWebViewWrapperRef | null) => {
    webviewRef.current = $ref;
  }, []);
  const [top, setTop] = useState(initTop);
  const [minimized, setMinimized] = useState(false);
  const config = useMemo(() => webEmbedConfig.getWebEmbedConfig(), []);
  useEffect(() => {
    if (!platformEnv.isNative) {
      return;
    }
    const jsBridge = webviewRef?.current?.jsBridge;
    if (!jsBridge) {
      return;
    }
    jsBridge.globalOnMessageEnabled = true;
    backgroundApiProxy.connectWebEmbedBridge(jsBridge);
  }, [webviewRef]);
  const remoteUrl = useMemo(() => {
    if (process.env.NODE_ENV !== 'production') {
      if (config?.url) {
        return config?.url;
      }
    }
    return undefined;
  }, [config?.url]);
  const nativeWebviewSource = useMemo(() => {
    if (remoteUrl) {
      return undefined;
    }
    // Android
    if (platformEnv.isNativeAndroid) {
      return {
        uri: 'file:///android_asset/web-embed/index.html',
      };
    }
    // iOS
    if (platformEnv.isNativeIOS) {
      return {
        uri: 'web-embed/index.html',
      };
    }
    return undefined;
  }, [remoteUrl]);

  const webview = useMemo(
    () => (
      <WebView
        // *** use remote url
        src={remoteUrl || ''}
        // *** use web-embed local html file
        nativeWebviewSource={nativeWebviewSource}
        onWebViewRef={onWebViewRef}
        customReceiveHandler={customReceiveHandler}
      />
    ),
    [customReceiveHandler, nativeWebviewSource, onWebViewRef, remoteUrl],
  );

  const webviewUrlOrUri = useMemo(() => {
    if (remoteUrl) {
      return remoteUrl;
    }
    return nativeWebviewSource?.uri || '';
  }, [nativeWebviewSource?.uri, remoteUrl]);

  const debugViewSize = useMemo(() => {
    if (config?.debug) {
      if (minimized) {
        return { width: '$8', height: '$6', borderWidth: 4 };
      }
      return { width: '90%', height: '$40', borderWidth: 4 };
    }
    return { width: 0, height: 0, borderWidth: 0 };
  }, [config?.debug, minimized]);

  if (!isSingleton) {
    return webview;
  }

  return (
    <View
      width={debugViewSize.width}
      height={debugViewSize.height}
      borderWidth={debugViewSize.borderWidth}
      top={top}
      left="5%"
      position="absolute"
      backgroundColor="$background"
      borderColor="$border"
    >
      {config?.debug && webviewUrlOrUri ? (
        <Stack>
          <XStack borderBottomWidth={2} borderColor="$border">
            <SizableText
              px="$2"
              size="$bodySm"
              onPress={() => {
                setMinimized((v) => !v);
              }}
            >
              X
            </SizableText>
            <SizableText
              flex={1}
              onPress={() => {
                setTop(top === initTop ? '70%' : initTop);
              }}
              size="$bodySm"
            >
              {webviewUrlOrUri}
            </SizableText>
          </XStack>
        </Stack>
      ) : null}
      {webview}
    </View>
  );
}

function WebViewWebEmbedSingletonView() {
  return <WebViewWebEmbed isSingleton />;
}

export const WebViewWebEmbedSingleton = memo(WebViewWebEmbedSingletonView);
