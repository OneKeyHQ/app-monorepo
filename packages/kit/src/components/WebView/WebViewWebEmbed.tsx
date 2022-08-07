import React, { useMemo } from 'react';

import WebView from './index';

import { IJsBridgeReceiveHandler } from '@onekeyfe/cross-inpage-provider-types';
import { IWebViewWrapperRef } from '@onekeyfe/onekey-cross-webview';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { useThemeProviderVariant } from '../../provider/ThemeProvider';

// import HTML_FILE from './web-embed-html';

// /onboarding/auto_typing
export function WebViewWebEmbed({
  src,
  routePath,
  customReceiveHandler,
  onWebViewRef,
  isSpinnerLoading,
}: {
  src?: string;
  routePath?: string;
  customReceiveHandler?: IJsBridgeReceiveHandler;
  onWebViewRef?: (ref: IWebViewWrapperRef | null) => void;
  isSpinnerLoading?: boolean;
}) {
  const { themeVariant, localeVariant, enableHaptics } =
    useThemeProviderVariant();
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
    if (platformEnv.isNativeIOS) {
      return {
        uri: 'web-embed/index.html',
      };
    }
    // DEV localhost:8081
    // return HTML_FILE;
    return undefined;
  }, [src]);
  return (
    <WebView
      src={src || ''}
      isSpinnerLoading={isSpinnerLoading}
      onWebViewRef={onWebViewRef}
      customReceiveHandler={customReceiveHandler}
      nativeWebviewSource={nativeWebviewSource}
      nativeInjectedJavaScriptBeforeContentLoaded={`
        window.location.hash = "${routePath || ''}";
        window.WEB_EMBED_ONEKEY_APP_SETTINGS = {
          themeVariant: "${themeVariant}",
          localeVariant: "${localeVariant}",
          enableHaptics: ${enableHaptics.toString()},
        };
      `}
    />
  );
}
