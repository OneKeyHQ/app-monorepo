import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
} from 'react';

import { WebView } from 'react-native-webview';

import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';

import { injectedNative } from '../injected-autogen';
import JsBridgeNativeHost from '../jsBridge/JsBridgeNativeHost';
import { InpageProviderWebViewProps } from '../types';

import { IWebViewWrapperRef } from './useWebViewBridge';

import type {
  WebViewMessageEvent,
  WebViewProgressEvent,
} from 'react-native-webview/lib/WebViewTypes';

const NativeWebView = forwardRef(
  (
    {
      src,
      receiveHandler,
      onSrcChange,
      onLoadProgress,
      ...props
    }: InpageProviderWebViewProps & {
      onLoadProgress?: (event: WebViewProgressEvent) => void;
    },
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
        const { data }: { data: string } = event.nativeEvent;
        const uri = new URL(event.nativeEvent.url);
        const origin = uri?.origin || '';
        debugLogger.webview('onMessage', origin, data);
        // - receive
        jsBridge.receive(data, { origin });
      },
      [jsBridge],
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
        {...props}
        cacheMode="LOAD_CACHE_ELSE_NETWORK" // TODO remove
        onLoadProgress={onLoadProgress}
        ref={webviewRef}
        // injectedJavaScript={injectedNative}
        injectedJavaScriptBeforeContentLoaded={injectedNative || ''}
        source={{ uri: src }}
        onMessage={webviewOnMessage}
      />
    );
  },
);
NativeWebView.displayName = 'NativeWebView';

export default NativeWebView;
