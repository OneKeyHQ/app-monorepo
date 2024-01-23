import {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useMemo,
  useRef,
} from 'react';

import { JsBridgeNativeHost } from '@onekeyfe/onekey-cross-webview';
import { WebView } from 'react-native-webview';

import { useTheme } from '@onekeyhq/components';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';

import { openUrlExternal } from '../../utils/openUrl';
import { checkOneKeyCardGoogleOauthUrl } from '../../utils/uriUtils';

import ErrorView from './ErrorView';

import type { InpageProviderWebViewProps } from '@onekeyfe/cross-inpage-provider-types';
import type { IWebViewWrapperRef } from '@onekeyfe/onekey-cross-webview';
import type { WebViewMessageEvent, WebViewProps } from 'react-native-webview';

export type NativeWebViewProps = WebViewProps & InpageProviderWebViewProps;

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
    const { themeVariant } = useTheme();
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
        const { data } = event.nativeEvent;
        try {
          const uri = new URL(event.nativeEvent.url);
          const origin = uri?.origin || '';
          debugLogger.webview.info('onMessage', origin, data);
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
        style={{
          flex: 1,
          backgroundColor: themeVariant === 'light' ? undefined : 'transparent',
        }}
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
