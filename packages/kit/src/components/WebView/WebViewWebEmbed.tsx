import { useMemo } from 'react';

import WebView from './index';

import { IJsBridgeReceiveHandler } from '@onekeyfe/cross-inpage-provider-types';
import { IWebViewWrapperRef } from '@onekeyfe/onekey-cross-webview';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { useThemeProviderVariant } from '../../provider/ThemeProvider';

// /onboarding/auto_typing
export function WebViewWebEmbed({
  src,
  routePath,
  customReceiveHandler,
  onWebViewRef,
  isSpinnerLoading,
  onContentLoaded,
}: {
  src?: string;
  routePath?: string;
  customReceiveHandler?: IJsBridgeReceiveHandler;
  onWebViewRef?: (ref: IWebViewWrapperRef | null) => void;
  isSpinnerLoading?: boolean;
  onContentLoaded?: () => void; // currently works in NativeWebView only
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
      onContentLoaded={onContentLoaded}
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
