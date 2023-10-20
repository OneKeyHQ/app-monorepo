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

// import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';

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
        const { data } = event.nativeEvent;
        try {
          const uri = new URL(event.nativeEvent.url);
          const origin = uri?.origin || '';
          // debugLogger.webview.info('onMessage', origin, data);
          console.log('onMessage: ', origin, data);
          // - receive
          jsBridge.receive(data, { origin });
        } catch {
          // noop
        }
        onMessage?.(event);
      },
      [jsBridge, onMessage],
    );

    useImperativeHandle(ref, (): IWebViewWrapperRef => {
      const wrapper = {
        innerRef: webviewRef.current,
        jsBridge,
        reload: () => webviewRef.current?.reload(),
        loadURL: (url: string) => webviewRef.current?.loadUrl(url),
      };

      jsBridge.webviewWrapper = wrapper;

      return wrapper;
    });

    // @ts-expect-error
    const webViewOnLoadStart = useCallback((syntheticEvent) => {
      // eslint-disable-next-line no-unsafe-optional-chaining, @typescript-eslint/no-unsafe-member-access
      const { url } = syntheticEvent?.nativeEvent;
      try {
        if (checkOneKeyCardGoogleOauthUrl({ url })) {
          openUrlExternal(url);
          webviewRef.current?.stopLoading();
        }
      } catch (error) {
        // debugLogger.webview.error('onLoadStart', error);
        console.log('onLoadStart: ', error);
      }
    }, []);

    const renderError = useCallback(
      (
        errorDomain: string | undefined,
        errorCode: number,
        errorDesc: string,
      ) => {
        // debugLogger.webview.error({ errorDomain, errorCode, errorDesc, src });
        console.log({ errorDomain, errorCode, errorDesc, src });
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
        style={styles.container}
        originWhitelist={['*']}
        allowFileAccess
        allowFileAccessFromFileURLs
        allowUniversalAccessFromFileURLs
        allowsBackForwardNavigationGestures
        fraudulentWebsiteWarningEnabled={false}
        onLoadProgress={onLoadProgress}
        ref={webviewRef}
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
