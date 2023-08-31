import {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useMemo,
  useRef,
} from 'react';

import { JsBridgeNativeHost } from '@onekeyfe/onekey-cross-webview';
import { StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';

import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { openUrlExternal } from '../../utils/openUrl';
import { checkOneKeyCardGoogleOauthUrl } from '../../utils/uriUtils';

import ErrorView from './ErrorView';

import type { InpageProviderWebViewProps } from '@onekeyfe/cross-inpage-provider-types';
import type { IWebViewWrapperRef } from '@onekeyfe/onekey-cross-webview';
import type { WebViewMessageEvent, WebViewProps } from 'react-native-webview';

export type NativeWebViewProps = WebViewProps & InpageProviderWebViewProps;

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'transparent',
    flex: 1,
  },
});
const NativeWebView = forwardRef(
  (
    {
      style,
      src,
      receiveHandler,
      onSrcChange,
      onLoadProgress,
      injectedJavaScriptBeforeContentLoaded,
      onMessage,
      ...props
    }: NativeWebViewProps,
    ref,
  ) => {
    const webviewRef = useRef<WebView>();

    const jsBridge = useMemo(
      () =>
        new JsBridgeNativeHost({
          webviewRef,
          receiveHandler,
        }),
      [receiveHandler],
    );

    const webviewOnMessage = useCallback(
      (event: WebViewMessageEvent) => {
        const { data, url } = event.nativeEvent;
        try {
          const uri = new URL(url);
          const origin = uri?.origin || '';

          // only log on DEV, as data may be sensitive
          if (process.env.NODE_ENV !== 'production') {
            debugLogger.webview.info('NativeWebView -> webviewOnMessage', {
              // android:
              //    file:///android_asset/web-embed/index.html#/webembed_api
              // ios: (missing #/webembed_api)
              //    file:///private/var/containers/Bundle/Application/130846AC-618F-4DEF-8BCD-925CAB7E578F/OneKeyWallet.app/web-embed/index.html
              url,
              uri,
              // ios/android:
              //    origin==="null"
              // web:
              //    origin==="file://"
              origin,
              data,
            });
          }

          // - receive
          jsBridge.receive(data, { origin });
          // eslint-disable-next-line no-empty
        } catch {}
        onMessage?.(event);
      },
      [jsBridge, onMessage],
    );

    useImperativeHandle(ref, (): IWebViewWrapperRef => {
      const wrapper = {
        innerRef: webviewRef.current,
        jsBridge,
        reload: () => webviewRef.current?.reload(),
        loadURL: (url: string) =>
          // @ts-ignore
          // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call
          webviewRef.current?.loadUrl(url),
      };

      jsBridge.webviewWrapper = wrapper;

      return wrapper;
    });

    const webViewOnLoadStart = useCallback((syntheticEvent) => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, no-unsafe-optional-chaining
      const { url } = syntheticEvent?.nativeEvent;
      try {
        if (webviewRef && webviewRef.current) {
          // @ts-ignore
          webviewRef.current.$$currentWebviewUrl = url;
        }

        if (checkOneKeyCardGoogleOauthUrl({ url })) {
          openUrlExternal(url);
          webviewRef.current?.stopLoading();
        }
      } catch (error) {
        debugLogger.webview.error('onLoadStart', error);
      }
    }, []);

    const renderError = useCallback(
      (
        errorDomain: string | undefined,
        errorCode: number,
        errorDesc: string,
      ) => {
        debugLogger.webview.error({ errorDomain, errorCode, errorDesc, src });
        return (
          <ErrorView
            errorCode={errorCode}
            onRefresh={() => webviewRef.current?.reload()}
          />
        );
      },
      [src],
    );

    return (
      <WebView
        webviewDebuggingEnabled={platformEnv.isDev}
        style={styles.container}
        originWhitelist={['*']}
        allowFileAccess
        allowFileAccessFromFileURLs
        allowUniversalAccessFromFileURLs
        allowsBackForwardNavigationGestures
        fraudulentWebsiteWarningEnabled={false}
        onLoadProgress={onLoadProgress}
        ref={webviewRef}
        // injectedJavaScript={injectedNative}
        injectedJavaScriptBeforeContentLoaded={
          injectedJavaScriptBeforeContentLoaded || ''
        }
        // the video element must also include the `playsinline` attribute
        allowsInlineMediaPlayback
        // disable video autoplay
        mediaPlaybackRequiresUserAction
        source={{ uri: src }}
        onMessage={webviewOnMessage}
        onLoadStart={webViewOnLoadStart}
        renderError={renderError}
        {...props}
      />
    );
  },
);
NativeWebView.displayName = 'NativeWebView';

export { NativeWebView };
