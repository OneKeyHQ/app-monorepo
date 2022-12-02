import {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useMemo,
  useRef,
} from 'react';

import { appDebugLogger } from '@onekeyfe/cross-inpage-provider-core';
import { InpageProviderWebViewProps } from '@onekeyfe/cross-inpage-provider-types';
import {
  IWebViewWrapperRef,
  JsBridgeNativeHost,
} from '@onekeyfe/onekey-cross-webview';
import { StyleSheet } from 'react-native';
import {
  WebView,
  WebViewMessageEvent,
  WebViewProps,
} from 'react-native-webview';

import ErrorView from './ErrorView';

export type NativeWebViewProps = WebViewProps & InpageProviderWebViewProps;

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'transparent',
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
        const { data } = event.nativeEvent;
        try {
          const uri = new URL(event.nativeEvent.url);
          const origin = uri?.origin || '';
          appDebugLogger.webview('onMessage', origin, data);
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

    return (
      <WebView
        style={styles.container}
        onLoadProgress={onLoadProgress}
        ref={webviewRef}
        // injectedJavaScript={injectedNative}
        injectedJavaScriptBeforeContentLoaded={
          injectedJavaScriptBeforeContentLoaded || ''
        }
        source={{ uri: src }}
        onMessage={webviewOnMessage}
        renderError={() => (
          <ErrorView onRefresh={() => webviewRef.current?.reload()} />
        )}
        {...props}
      />
    );
  },
);
NativeWebView.displayName = 'NativeWebView';

export { NativeWebView };
