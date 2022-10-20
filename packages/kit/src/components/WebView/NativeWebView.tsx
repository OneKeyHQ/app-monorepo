/* eslint-disable  @typescript-eslint/ban-ts-comment  */
import React, {
  forwardRef,
  useCallback,
  useEffect,
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
import { WebView, WebViewProps } from 'react-native-webview';

import type { ViewStyle } from 'react-native';
import type { WebViewMessageEvent } from 'react-native-webview/lib/WebViewTypes';

export type NativeWebViewProps = WebViewProps &
  InpageProviderWebViewProps & {
    style?: ViewStyle;
  };

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
    const webviewRef = useRef<WebView | null>(null);

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
        const uri = new URL(event.nativeEvent.url);
        const origin = uri?.origin || '';
        appDebugLogger.webview('onMessage', origin, data);
        // - receive
        jsBridge.receive(data, { origin });
        onMessage?.(event);
      },
      [jsBridge, onMessage],
    );

    useImperativeHandle(ref, (): IWebViewWrapperRef => {
      const wrapper = {
        innerRef: webviewRef.current,
        jsBridge,
        reload: () => webviewRef.current?.reload(),
        loadURL: (url: string) => {
          // ReactNativeWebview do not has method to loadURL
          // so we need src props change it
          if (onSrcChange) {
            onSrcChange(url);
          } else {
            console.warn(
              'NativeWebView: Please pass onSrcChange props to enable loadURL() working.',
            );
          }
        },
      };

      jsBridge.webviewWrapper = wrapper;

      return wrapper;
    });

    useEffect(() => {
      // console.log('NativeWebView injectedJavaScript \r\n', injectedNative);
    }, []);

    return (
      <WebView
        // @ts-ignore
        style={[{ backgroundColor: 'transparent' }, style]}
        onLoadProgress={onLoadProgress}
        ref={webviewRef}
        // injectedJavaScript={injectedNative}
        injectedJavaScriptBeforeContentLoaded={
          injectedJavaScriptBeforeContentLoaded || ''
        }
        source={{ uri: src }}
        onMessage={webviewOnMessage}
        {...props}
      />
    );
  },
);
NativeWebView.displayName = 'NativeWebView';

export { NativeWebView };
