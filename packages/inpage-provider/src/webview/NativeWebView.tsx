import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
} from 'react';

import { WebView } from 'react-native-webview';

import { injectedNative } from '../injected-autogen';
import JsBridgeNativeHost from '../jsBridge/JsBridgeNativeHost';
import { IJsBridgeReceiveHandler } from '../types';

import { IWebViewWrapperRef } from './useWebViewBridge';

const NativeWebView = forwardRef(
  (
    {
      src,
      receiveHandler,
      ...props
    }: {
      src: string;
      receiveHandler: IJsBridgeReceiveHandler;
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

    useImperativeHandle(
      ref,
      (): IWebViewWrapperRef => ({
        innerRef: webviewRef,
        jsBridge,
        reload: () => webviewRef.current?.reload(),
      }),
    );

    useEffect(() => {
      // console.log('NativeWebView injectedJavaScript \r\n', injectedNative);
    }, []);

    return (
      <WebView
        {...props}
        ref={webviewRef}
        // injectedJavaScript={injectedNative}
        injectedJavaScriptBeforeContentLoaded={injectedNative || ''}
        source={{ uri: src }}
        // TODO useCallback
        onMessage={(event) => {
          const { data }: { data: string } = event.nativeEvent;
          console.log('NativeWebView receive message', data);
          // - receive
          jsBridge.receive(data);
        }}
      />
    );
  },
);
NativeWebView.displayName = 'NativeWebView';

export default NativeWebView;
