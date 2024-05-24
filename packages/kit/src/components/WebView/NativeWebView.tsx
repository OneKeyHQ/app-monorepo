import {
  createRef,
  forwardRef,
  useCallback,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';

import { JsBridgeNativeHost } from '@onekeyfe/onekey-cross-webview';
import { WebView } from '@onekeyfe/react-native-webview';
import { RefreshControl, StyleSheet } from 'react-native';

// import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';

import { Stack } from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { openUrlExternal } from '@onekeyhq/shared/src/utils/openUrlUtils';
import { checkOneKeyCardGoogleOauthUrl } from '@onekeyhq/shared/src/utils/uriUtils';

import ErrorView from './ErrorView';

import type { IInpageProviderWebViewProps } from './types';
import type { IWebViewWrapperRef } from '@onekeyfe/onekey-cross-webview';
import type {
  WebViewMessageEvent,
  WebViewProps,
} from '@onekeyfe/react-native-webview';

export type INativeWebViewProps = WebViewProps & IInpageProviderWebViewProps;

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
      onLoadStart,
      onLoad,
      onLoadEnd,
      onScroll,
      pullToRefreshEnabled = true,
      ...props
    }: INativeWebViewProps,
    ref,
  ) => {
    const webviewRef = useRef<WebView>();
    const refreshControlRef = useMemo(() => createRef<RefreshControl>(), []);
    const [isRefresh] = useState(false);
    const onRefresh = useCallback(() => {
      webviewRef.current?.reload();
    }, []);

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
          // console.log('onMessage: ', origin, data);
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

    const webViewOnLoadStart = useCallback(
      // @ts-expect-error
      (syntheticEvent) => {
        // eslint-disable-next-line no-unsafe-optional-chaining, @typescript-eslint/no-unsafe-member-access
        const { url } = syntheticEvent?.nativeEvent;
        try {
          if (checkOneKeyCardGoogleOauthUrl({ url })) {
            openUrlExternal(url);
            webviewRef.current?.stopLoading();
          }
          onLoadStart?.(syntheticEvent);
        } catch (error) {
          // debugLogger.webview.error('onLoadStart', error);
          console.log('onLoadStart: ', error);
        }
      },
      [onLoadStart],
    );

    const renderError = useCallback(
      (
        errorDomain: string | undefined,
        errorCode: number,
        errorDesc: string,
      ) => {
        // debugLogger.webview.error({ errorDomain, errorCode, errorDesc, src });
        console.log({ errorDomain, errorCode, errorDesc, src });
        return (
          <Stack position="absolute" top={0} bottom={0} left={0} right={0}>
            <ErrorView
              errorCode={errorCode}
              onRefresh={() => webviewRef.current?.reload()}
            />
          </Stack>
        );
      },
      [src],
    );

    const renderLoading = useCallback(() => <Stack />, []);

    const renderWebView = (
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
        onLoad={onLoad}
        onLoadEnd={onLoadEnd}
        renderError={renderError}
        renderLoading={renderLoading}
        pullToRefreshEnabled={pullToRefreshEnabled}
        onScroll={(e) => {
          if (platformEnv.isNativeAndroid && pullToRefreshEnabled) {
            const {
              contentOffset,
              contentSize,
              contentInset,
              layoutMeasurement,
            } = e.nativeEvent;
            // @ts-expect-error
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
            refreshControlRef?.current?._nativeRef?.setNativeProps?.({
              enabled:
                contentOffset?.y === 0 &&
                Math.round(contentSize.height) >
                  Math.round(
                    layoutMeasurement.height +
                      contentInset.top +
                      contentInset.bottom,
                  ),
            });
          }
          void onScroll?.(e);
        }}
        scrollEventThrottle={16}
        webviewDebuggingEnabled={__DEV__}
        {...props}
      />
    );

    return platformEnv.isNativeAndroid && pullToRefreshEnabled ? (
      <RefreshControl
        ref={refreshControlRef}
        style={{ flex: 1 }}
        onRefresh={onRefresh}
        refreshing={isRefresh}
        enabled={false}
      >
        {renderWebView}
      </RefreshControl>
    ) : (
      renderWebView
    );
  },
);
NativeWebView.displayName = 'NativeWebView';

export { NativeWebView };
