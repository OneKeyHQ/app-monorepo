import {
  createRef,
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';

import { JsBridgeNativeHost } from '@onekeyfe/onekey-cross-webview';
import { RefreshControl, StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';

// import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';

import { Stack } from '@onekeyhq/components';
import { useDevSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import GeckoView from '@onekeyhq/shared/src/modules3rdParty/geckoview';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { openUrlExternal } from '@onekeyhq/shared/src/utils/openUrlUtils';
import uriUtils, {
  checkOneKeyCardGoogleOauthUrl,
} from '@onekeyhq/shared/src/utils/uriUtils';

import ErrorView from './ErrorView';
import { createMessageInjectedScript } from './utils';

import type { IInpageProviderWebViewProps, IWebViewRef } from './types';
import type { IWebViewWrapperRef } from '@onekeyfe/onekey-cross-webview';
import type { WebViewMessageEvent, WebViewProps } from 'react-native-webview';
import type { WebViewRenderProcessGoneEvent } from 'react-native-webview/lib/WebViewTypes';

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
      src,
      receiveHandler,
      onLoadProgress,
      injectedJavaScriptBeforeContentLoaded,
      onMessage,
      onLoadStart,
      onLoad,
      onLoadEnd,
      onScroll,
      pullToRefreshEnabled = true,
      webviewDebuggingEnabled,
      useGeckoView,
      allowsBackForwardNavigationGestures = true,
      ...props
    }: INativeWebViewProps,
    ref,
  ) => {
    const webviewRef = useRef<WebView>(undefined);
    const refreshControlRef = useMemo(() => createRef<RefreshControl>(), []);
    const [isRefresh] = useState(false);
    const isUnmountingRef = useRef(false);
    const [webViewKey, setWebViewKey] = useState(0);

    const onRefresh = useCallback(() => {
      if (isUnmountingRef.current) return;
      webviewRef.current?.reload();
    }, []);

    // Cleanup WebView on unmount to prevent native crashes during navigation
    useEffect(() => {
      // Capture webview ref in effect scope to satisfy exhaustive-deps
      const webview = webviewRef.current;

      return () => {
        isUnmountingRef.current = true;

        try {
          // Stop WebView loading before component unmounts
          webview?.stopLoading();
        } catch (error) {
          // Ignore errors during cleanup - native resources may already be freed
          console.log('NativeWebView cleanup error:', error);
        }
      };
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
        // Guard against events after unmount started
        if (isUnmountingRef.current) return;

        const { data, url } = event.nativeEvent;
        try {
          const origin = uriUtils.getOriginFromUrl({ url: url || src });
          if (origin) {
            jsBridge.receive(data, { origin });
          }
        } catch (_error) {
          // noop
        }
        onMessage?.(event);
      },
      [jsBridge, onMessage, src],
    );

    useImperativeHandle(ref, (): IWebViewWrapperRef => {
      const wrapper = {
        innerRef: webviewRef.current,
        jsBridge,
        reload: () => webviewRef.current?.reload(),
        loadURL: (url: string) => webviewRef.current?.loadUrl(url),
        sendMessageViaInjectedScript: (message: unknown) => {
          const script = createMessageInjectedScript(message);
          webviewRef.current?.injectJavaScript(script);
        },
      };

      jsBridge.webviewWrapper = wrapper;

      return wrapper as IWebViewRef;
    });

    const webViewOnLoadStart = useCallback(
      // @ts-expect-error
      (syntheticEvent) => {
        // Guard against events after unmount started
        if (isUnmountingRef.current) return;

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
        // Guard against errors during unmount - return empty stack instead of null
        if (isUnmountingRef.current) {
          return <Stack />;
        }

        // debugLogger.webview.error({ errorDomain, errorCode, errorDesc, src });
        console.log({ errorDomain, errorCode, errorDesc, src });
        return (
          <Stack position="absolute" top={0} bottom={0} left={0} right={0}>
            <ErrorView
              errorCode={errorCode}
              onRefresh={() => {
                if (isUnmountingRef.current) return;
                webviewRef.current?.reload();
              }}
            />
          </Stack>
        );
      },
      [src],
    );

    const [devSettings] = useDevSettingsPersistAtom();

    const renderLoading = useCallback(() => <Stack />, []);

    // Wrap callbacks with unmount guard to prevent crashes
    const safeOnLoadProgress = useCallback(
      (event: any) => {
        if (isUnmountingRef.current) return;
        onLoadProgress?.(event);
      },
      [onLoadProgress],
    );

    const safeOnLoad = useCallback(
      (event: any) => {
        if (isUnmountingRef.current) return;
        onLoad?.(event);
      },
      [onLoad],
    );

    const safeOnLoadEnd = useCallback(
      (event: any) => {
        if (isUnmountingRef.current) return;
        onLoadEnd?.(event);
      },
      [onLoadEnd],
    );

    const safeOnScroll = useCallback(
      (e: any) => {
        if (isUnmountingRef.current) return;

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
      },
      [onScroll, pullToRefreshEnabled, refreshControlRef],
    );

    const handleRenderProcessGone = useCallback(
      (event: WebViewRenderProcessGoneEvent) => {
        if (isUnmountingRef.current) return;
        const { didCrash } = event.nativeEvent;
        console.warn(
          `WebView render process gone (didCrash: ${didCrash}), recreating WebView`,
        );
        // Bump key to force React to unmount the dead WebView and mount a fresh one
        setWebViewKey((prev) => prev + 1);
      },
      [],
    );

    const debuggingEnabled = useMemo(() => {
      if (__DEV__) {
        return true;
      }

      if (
        devSettings.enabled &&
        devSettings.settings?.webviewDebuggingEnabled
      ) {
        return true;
      }

      return webviewDebuggingEnabled;
    }, [
      devSettings.enabled,
      devSettings.settings?.webviewDebuggingEnabled,
      webviewDebuggingEnabled,
    ]);

    const renderWebView = useMemo(() => {
      if (useGeckoView) {
        return (
          <GeckoView
            style={styles.container}
            ref={webviewRef as any}
            injectedJavaScriptBeforeContentLoaded={
              injectedJavaScriptBeforeContentLoaded || ''
            }
            source={{ uri: src }}
            onMessage={webviewOnMessage as any}
            onLoadingProgress={safeOnLoadProgress as any}
            onLoadingStart={webViewOnLoadStart}
            onLoadingFinish={safeOnLoadEnd as any}
            remoteDebugging={debuggingEnabled}
            {...props}
          />
        );
      }
      return (
        <WebView
          key={webViewKey}
          cacheEnabled={false}
          style={styles.container}
          originWhitelist={['*']}
          allowsBackForwardNavigationGestures={
            allowsBackForwardNavigationGestures
          }
          fraudulentWebsiteWarningEnabled={false}
          onLoadProgress={safeOnLoadProgress}
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
          onLoad={safeOnLoad}
          onLoadEnd={safeOnLoadEnd}
          renderError={renderError}
          renderLoading={renderLoading}
          pullToRefreshEnabled={pullToRefreshEnabled}
          onScroll={safeOnScroll}
          scrollEventThrottle={16}
          webviewDebuggingEnabled={debuggingEnabled}
          onRenderProcessGone={handleRenderProcessGone}
          {...props}
        />
      );
    }, [
      debuggingEnabled,
      handleRenderProcessGone,
      injectedJavaScriptBeforeContentLoaded,
      safeOnLoad,
      safeOnLoadEnd,
      safeOnLoadProgress,
      safeOnScroll,
      props,
      pullToRefreshEnabled,
      renderError,
      renderLoading,
      src,
      useGeckoView,
      webViewKey,
      webViewOnLoadStart,
      webviewOnMessage,
      allowsBackForwardNavigationGestures,
    ]);

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
