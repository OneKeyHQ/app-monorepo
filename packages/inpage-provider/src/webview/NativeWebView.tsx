import React, {
  useImperativeHandle,
  useMemo,
  useRef,
  forwardRef,
  useEffect,
} from 'react';
import { WebView } from '@onekeyhq/components';
import createJsBridgeHost from '../jsBridge/createJsBridgeHost';
import { injectedNative } from '../injected-autogen';

export type ProviderWebViewProps = {
  uri: string;
};
export type JsBridgeWebViewRef = {
  webviewRef?: WebView | null;
  jsBridge: any;
};

const NativeWebView = forwardRef(
  ({ uri, ...props }: ProviderWebViewProps, ref) => {
    const webviewRef = useRef<WebView | null>(null);

    const jsBridge = useMemo(
      () =>
        createJsBridgeHost({
          webviewRef,
          isReactNative: true,
        }),
      [],
    );

    useImperativeHandle(ref, () => ({
      innerRef: webviewRef,
      jsBridge,
    }));

    useEffect(() => {
      // console.log('NativeWebView injectedJavaScript \r\n', injectedNative);
    }, []);

    return (
      <WebView
        {...props}
        ref={webviewRef}
        // injectedJavaScript={injectedNative}
        injectedJavaScriptBeforeContentLoaded={injectedNative || ''}
        source={{ uri }}
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
