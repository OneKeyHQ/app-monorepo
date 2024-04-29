import { useCallback, useEffect, useMemo, useRef } from 'react';

import WebView from '.';

import backgroundApiProxy from '@onekeyhq/kit/src//background/instance/backgroundApiProxy';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import type { IJsBridgeReceiveHandler } from '@onekeyfe/cross-inpage-provider-types';
import type { IWebViewWrapperRef } from '@onekeyfe/onekey-cross-webview';

// /onboarding/auto_typing
export function WebViewWebEmbed({
  src,
  customReceiveHandler,
}: {
  src?: string;
  customReceiveHandler?: IJsBridgeReceiveHandler;
}) {
  const webviewRef = useRef<IWebViewWrapperRef | null>(null);
  const onWebViewRef = useCallback(($ref: IWebViewWrapperRef | null) => {
    webviewRef.current = $ref;
  }, []);
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
  const nativeWebviewSource = useMemo(() => {
    if (src) {
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
  }, [src]);
  return (
    <WebView
      src={src || ''}
      onWebViewRef={onWebViewRef}
      customReceiveHandler={customReceiveHandler}
      nativeWebviewSource={nativeWebviewSource}
    />
  );
}
