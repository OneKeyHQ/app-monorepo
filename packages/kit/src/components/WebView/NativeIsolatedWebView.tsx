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

import { RefreshControl, StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';

import { Stack } from '@onekeyhq/components';
import { useDevSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { WEB_EMBED_ANDROID_LOCAL_ORIGIN } from '@onekeyhq/shared/src/consts/webEmbedConsts';
import GeckoView from '@onekeyhq/shared/src/modules3rdParty/geckoview';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { openUrlExternal } from '@onekeyhq/shared/src/utils/openUrlUtils';
import { checkOneKeyCardGoogleOauthUrl } from '@onekeyhq/shared/src/utils/uriUtils';

import ErrorView from './ErrorView';
import { WEBVIEW_LOAD_TIMEOUT_MS, createMessageInjectedScript } from './utils';

import type { IInpageProviderWebViewProps, IWebViewRef } from './types';
import type { IWebViewWrapperRef } from '@onekeyfe/onekey-cross-webview';
import type { WebViewMessageEvent, WebViewProps } from 'react-native-webview';
import type {
  WebViewRenderProcessGoneEvent,
  WebViewScrollEvent,
} from 'react-native-webview/lib/WebViewTypes';

export type INativeIsolatedWebViewProps = WebViewProps &
  IInpageProviderWebViewProps;

const WEB_EMBED_ANDROID_LOCAL_HOST = new URL(WEB_EMBED_ANDROID_LOCAL_ORIGIN)
  .host;

function isWebEmbedLocalOriginSrc(src: string | undefined): boolean {
  if (!platformEnv.isNativeAndroid || !src) return false;
  try {
    return new URL(src).host.toLowerCase() === WEB_EMBED_ANDROID_LOCAL_HOST;
  } catch {
    return false;
  }
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'transparent',
    flex: 1,
  },
});

const NativeIsolatedWebView = forwardRef(
  (
    {
      src,
      onLoadProgress,
      injectedJavaScriptBeforeContentLoaded,
      onMessage,
      onLoadStart,
      onLoad,
      onLoadEnd,
      onScroll,
      style,
      containerStyle,
      pullToRefreshEnabled = true,
      webviewDebuggingEnabled,
      useGeckoView,
      allowsBackForwardNavigationGestures = true,
      recreateOnContentProcessTerminate,
      ...props
    }: INativeIsolatedWebViewProps,
    ref,
  ) => {
    const safeSrc = isWebEmbedLocalOriginSrc(src) ? 'about:blank' : src;
    const webviewRef = useRef<WebView>(undefined);
    const refreshControlRef = useMemo(() => createRef<RefreshControl>(), []);
    const [isRefresh] = useState(false);
    const isUnmountingRef = useRef(false);
    const [webViewKey, setWebViewKey] = useState(0);
    const [loadTimeoutError, setLoadTimeoutError] = useState(false);
    const loadTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const clearLoadTimeout = useCallback(() => {
      if (loadTimeoutRef.current) {
        clearTimeout(loadTimeoutRef.current);
        loadTimeoutRef.current = null;
      }
    }, []);

    const startLoadTimeout = useCallback(() => {
      clearLoadTimeout();
      loadTimeoutRef.current = setTimeout(() => {
        if (!isUnmountingRef.current) {
          setLoadTimeoutError(true);
        }
      }, WEBVIEW_LOAD_TIMEOUT_MS);
    }, [clearLoadTimeout]);

    const onRefresh = useCallback(() => {
      if (isUnmountingRef.current) return;
      webviewRef.current?.reload();
    }, []);

    useEffect(() => {
      const webview = webviewRef.current;

      return () => {
        isUnmountingRef.current = true;
        clearLoadTimeout();

        try {
          webview?.stopLoading();
        } catch (error) {
          console.log('NativeIsolatedWebView cleanup error:', error);
        }
      };
    }, [clearLoadTimeout]);

    const webviewOnMessage = useCallback(
      (event: WebViewMessageEvent) => {
        if (isUnmountingRef.current) return;
        onMessage?.(event);
      },
      [onMessage],
    );

    useImperativeHandle(ref, (): IWebViewWrapperRef => {
      const wrapper = {
        get innerRef() {
          return webviewRef.current;
        },
        reload: () => webviewRef.current?.reload(),
        loadURL: (url: string) => webviewRef.current?.loadUrl(url),
        sendMessageViaInjectedScript: (message: unknown) => {
          const script = createMessageInjectedScript(message);
          webviewRef.current?.injectJavaScript(script);
        },
      };
      return wrapper as IWebViewRef;
    });

    const webViewOnLoadStart = useCallback(
      // @ts-expect-error
      (syntheticEvent) => {
        if (isUnmountingRef.current) return;

        // eslint-disable-next-line no-unsafe-optional-chaining, @typescript-eslint/no-unsafe-member-access
        const { loading, url } = syntheticEvent?.nativeEvent;
        setLoadTimeoutError(false);
        if (platformEnv.isNativeAndroid && !useGeckoView && loading === false) {
          clearLoadTimeout();
        } else {
          startLoadTimeout();
        }

        try {
          if (checkOneKeyCardGoogleOauthUrl({ url })) {
            openUrlExternal(url, { useSystemBrowser: true });
            webviewRef.current?.stopLoading();
          }
          onLoadStart?.(syntheticEvent);
        } catch (error) {
          console.log('onLoadStart: ', error);
        }
      },
      [clearLoadTimeout, onLoadStart, startLoadTimeout, useGeckoView],
    );

    const renderError = useCallback(
      (
        errorDomain: string | undefined,
        errorCode: number,
        errorDesc: string,
      ) => {
        if (isUnmountingRef.current) {
          return <Stack />;
        }

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
        clearLoadTimeout();
        setLoadTimeoutError(false);
        onLoad?.(event);
      },
      [clearLoadTimeout, onLoad],
    );

    const safeOnLoadEnd = useCallback(
      (event: any) => {
        if (isUnmountingRef.current) return;
        clearLoadTimeout();
        setLoadTimeoutError(false);
        onLoadEnd?.(event);
      },
      [clearLoadTimeout, onLoadEnd],
    );

    const handleScroll: ((event: WebViewScrollEvent) => void) | undefined =
      onScroll;
    const safeOnScroll = useCallback(
      (e: WebViewScrollEvent) => {
        if (isUnmountingRef.current) return;

        if (platformEnv.isNativeAndroid && pullToRefreshEnabled) {
          const {
            contentOffset,
            contentSize,
            contentInset,
            layoutMeasurement,
          } = e.nativeEvent;
          // @ts-expect-error
          // oxlint-disable-next-line @typescript-eslint/no-unsafe-call -- React Native does not type the private inner ref
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
        handleScroll?.(e);
      },
      [handleScroll, pullToRefreshEnabled, refreshControlRef],
    );

    const handleRenderProcessGone = useCallback(
      (event: WebViewRenderProcessGoneEvent) => {
        if (isUnmountingRef.current) return;
        const { didCrash } = event.nativeEvent;
        console.warn(
          `WebView render process gone (didCrash: ${didCrash}), recreating WebView`,
        );
        if (typeof recreateOnContentProcessTerminate === 'function') {
          recreateOnContentProcessTerminate();
        } else {
          setWebViewKey((prev) => prev + 1);
        }
      },
      [recreateOnContentProcessTerminate],
    );

    const handleContentProcessDidTerminate = useCallback(() => {
      if (isUnmountingRef.current) return;
      console.warn('WebView content process terminated, recreating WebView');
      if (typeof recreateOnContentProcessTerminate === 'function') {
        recreateOnContentProcessTerminate();
      } else {
        setWebViewKey((prev) => prev + 1);
      }
    }, [recreateOnContentProcessTerminate]);

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
            style={[styles.container, style]}
            ref={webviewRef as any}
            injectedJavaScriptBeforeContentLoaded={
              injectedJavaScriptBeforeContentLoaded || ''
            }
            source={{ uri: safeSrc }}
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
          style={[styles.container, style]}
          containerStyle={[styles.container, containerStyle]}
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
          allowsInlineMediaPlayback
          mediaPlaybackRequiresUserAction
          source={{ uri: safeSrc }}
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
          onContentProcessDidTerminate={
            recreateOnContentProcessTerminate
              ? handleContentProcessDidTerminate
              : undefined
          }
          {...props}
        />
      );
    }, [
      debuggingEnabled,
      handleRenderProcessGone,
      handleContentProcessDidTerminate,
      recreateOnContentProcessTerminate,
      injectedJavaScriptBeforeContentLoaded,
      safeOnLoad,
      safeOnLoadEnd,
      safeOnLoadProgress,
      safeOnScroll,
      style,
      containerStyle,
      props,
      pullToRefreshEnabled,
      renderError,
      renderLoading,
      safeSrc,
      useGeckoView,
      webViewKey,
      webViewOnLoadStart,
      webviewOnMessage,
      allowsBackForwardNavigationGestures,
    ]);

    const timeoutErrorOverlay = loadTimeoutError ? (
      <Stack position="absolute" top={0} bottom={0} left={0} right={0}>
        <ErrorView
          onRefresh={() => {
            if (isUnmountingRef.current) return;
            setLoadTimeoutError(false);
            webviewRef.current?.reload();
          }}
        />
      </Stack>
    ) : null;

    return platformEnv.isNativeAndroid && pullToRefreshEnabled ? (
      <RefreshControl
        ref={refreshControlRef}
        style={{ flex: 1 }}
        onRefresh={onRefresh}
        refreshing={isRefresh}
        enabled={false}
      >
        {renderWebView}
        {timeoutErrorOverlay}
      </RefreshControl>
    ) : (
      <>
        {renderWebView}
        {timeoutErrorOverlay}
      </>
    );
  },
);
NativeIsolatedWebView.displayName = 'NativeIsolatedWebView';

export { NativeIsolatedWebView };
