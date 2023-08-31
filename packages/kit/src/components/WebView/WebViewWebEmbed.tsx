import { useMemo } from 'react';

import WebView from './index';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { useThemeProviderVariant } from '../../provider/ThemeProvider';

import type { IJsBridgeReceiveHandler } from '@onekeyfe/cross-inpage-provider-types';
import type { IWebViewWrapperRef } from '@onekeyfe/onekey-cross-webview';

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
  const { themeVariant, localeVariant } = useThemeProviderVariant();
  const nativeWebviewSource = useMemo(() => {
    // *** use remote url, start dev server first `yarn web-embed`
    if (src) {
      return undefined;
    }
    // Android
    if (platformEnv.isNativeAndroid) {
      // Android full path:
      //      "file:///android_asset/web-embed/index.html#/webembed_api"
      return {
        uri: 'file:///android_asset/web-embed/index.html',
      };
    }
    // iOS
    if (platformEnv.isNativeIOS) {
      // iOS full path like(missing #/webembed_api):
      //      file:///private/var/containers/Bundle/Application/130846AC-618F-4DEF-8BCD-925CAB7E578F/OneKeyWallet.app/web-embed/index.html
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
        };
      `}
    />
  );
}
