import {
  createRef,
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
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
import {
  createWebViewAvailabilityTiming,
  reportWebViewAvailabilityResult,
  reportWebViewRenderProcessGone,
} from '@onekeyhq/shared/src/request/availabilityMetrics';
import type { IWebViewAvailabilityTiming } from '@onekeyhq/shared/src/request/availabilityMetrics';
import { openUrlExternal } from '@onekeyhq/shared/src/utils/openUrlUtils';
import uriUtils, {
  checkOneKeyCardGoogleOauthUrl,
} from '@onekeyhq/shared/src/utils/uriUtils';

import ErrorView from './ErrorView';
import { WEBVIEW_LOAD_TIMEOUT_MS, createMessageInjectedScript } from './utils';

import type { IInpageProviderWebViewProps, IWebViewRef } from './types';
import type { IWebViewWrapperRef } from '@onekeyfe/onekey-cross-webview';
import type { WebViewMessageEvent, WebViewProps } from 'react-native-webview';
import type {
  WebViewErrorEvent,
  WebViewHttpErrorEvent,
  WebViewNavigationEvent,
  WebViewProgressEvent,
  WebViewRenderProcessGoneEvent,
  WebViewSource,
} from 'react-native-webview/lib/WebViewTypes';

export type INativeWebViewProps = WebViewProps & IInpageProviderWebViewProps;

type IMainFrameHttpError = {
  statusCode: number;
  url: string;
};

// ERROR_CODE.CONNECTION_FAILED of the patched react-native-webview
// onLoadingProgress, which shows the error view without raising onError.
const ANDROID_CONNECTION_FAILED_ERROR_CODE = -1_001_000;

function getNativeSourceUri(
  source: WebViewSource | undefined,
  src: string | undefined,
) {
  if (!source) {
    return src;
  }
  return 'uri' in source ? source.uri : undefined;
}

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
      onError,
      onHttpError,
      onScroll,
      style,
      containerStyle,
      pullToRefreshEnabled = true,
      webviewDebuggingEnabled,
      useGeckoView,
      allowsBackForwardNavigationGestures = true,
      disableBridge,
      ...props
    }: INativeWebViewProps,
    ref,
  ) => {
    const webviewRef = useRef<WebView>(undefined);
    const refreshControlRef = useMemo(() => createRef<RefreshControl>(), []);
    const [isRefresh] = useState(false);
    const isUnmountingRef = useRef(false);
    const [webViewKey, setWebViewKey] = useState(0);
    const [loadTimeoutError, setLoadTimeoutError] = useState(false);
    const loadTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const availabilityTimingRef = useRef<
      IWebViewAvailabilityTiming | undefined
    >(undefined);
    // Android (non-GeckoView) dispatches onLoadStart at commit, after
    // pre-commit failures and HTTP errors, and emits onLoad right before
    // onError when a load fails. Its attempts therefore start when this
    // component asks the WebView to load, and success settles one tick later.
    const isAndroidWebView = Boolean(
      platformEnv.isNativeAndroid && !useGeckoView,
    );
    const nativeSourceUri = getNativeSourceUri(props.source, src);
    const lastNavigationUrlRef = useRef<string | undefined>(undefined);
    const lastMainFrameHttpErrorRef = useRef<IMainFrameHttpError | undefined>(
      undefined,
    );
    const pendingAndroidLoadOkTimerRef = useRef<
      ReturnType<typeof setTimeout> | undefined
    >(undefined);
    const androidAttemptDeadlineRef = useRef<
      ReturnType<typeof setTimeout> | undefined
    >(undefined);
    const androidSourceLoadRef = useRef<
      { uri: string | undefined; webViewKey: number } | undefined
    >(undefined);

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
          reportWebViewAvailabilityResult({
            status: 'timeout',
            timing: availabilityTimingRef.current,
          });
          setLoadTimeoutError(true);
        }
      }, WEBVIEW_LOAD_TIMEOUT_MS);
    }, [clearLoadTimeout]);

    const clearPendingAndroidLoadOk = useCallback(() => {
      const timer = pendingAndroidLoadOkTimerRef.current;
      if (timer !== undefined) {
        clearTimeout(timer);
        pendingAndroidLoadOkTimerRef.current = undefined;
      }
    }, []);

    const clearAndroidAttemptDeadline = useCallback(() => {
      const deadline = androidAttemptDeadlineRef.current;
      if (deadline !== undefined) {
        clearTimeout(deadline);
        androidAttemptDeadlineRef.current = undefined;
      }
    }, []);

    const reportMatchingMainFrameHttpError = useCallback(
      (timing: IWebViewAvailabilityTiming, url: string) => {
        const httpError = lastMainFrameHttpErrorRef.current;
        if (!httpError || httpError.url !== url) {
          return false;
        }
        lastMainFrameHttpErrorRef.current = undefined;
        reportWebViewAvailabilityResult({
          errorCode: httpError.statusCode,
          status: 'http_error',
          timing,
        });
        clearAndroidAttemptDeadline();
        return true;
      },
      [clearAndroidAttemptDeadline],
    );

    const beginAndroidAvailabilityAttempt = useCallback(
      (url: string | undefined) => {
        clearPendingAndroidLoadOk();
        lastMainFrameHttpErrorRef.current = undefined;
        const availabilityTiming = availabilityTimingRef.current;
        if (availabilityTiming && !availabilityTiming.reported) {
          // A load superseding an unfinished one continues it, keeping its
          // original deadline.
          if (url) {
            availabilityTiming.url = url;
          }
          return;
        }
        clearAndroidAttemptDeadline();
        const nextTiming = createWebViewAvailabilityTiming({ url });
        availabilityTimingRef.current = nextTiming;
        if (!nextTiming) {
          return;
        }
        // Metric-only: the load timeout starts at commit, so an attempt that
        // hangs before committing would otherwise end as cancelled.
        const deadline = setTimeout(() => {
          if (androidAttemptDeadlineRef.current === deadline) {
            androidAttemptDeadlineRef.current = undefined;
          }
          if (
            isUnmountingRef.current ||
            nextTiming.reported ||
            nextTiming !== availabilityTimingRef.current
          ) {
            return;
          }
          reportWebViewAvailabilityResult({
            status: 'timeout',
            timing: nextTiming,
          });
        }, WEBVIEW_LOAD_TIMEOUT_MS);
        androidAttemptDeadlineRef.current = deadline;
      },
      [clearAndroidAttemptDeadline, clearPendingAndroidLoadOk],
    );

    const beginAndroidReloadAttempt = useCallback(() => {
      if (!isAndroidWebView || !webviewRef.current) {
        return;
      }
      beginAndroidAvailabilityAttempt(
        lastNavigationUrlRef.current ?? nativeSourceUri,
      );
    }, [beginAndroidAvailabilityAttempt, isAndroidWebView, nativeSourceUri]);

    useLayoutEffect(() => {
      if (!isAndroidWebView) {
        return;
      }
      const previousLoad = androidSourceLoadRef.current;
      androidSourceLoadRef.current = { uri: nativeSourceUri, webViewKey };
      if (
        previousLoad?.webViewKey === webViewKey &&
        (previousLoad.uri === nativeSourceUri ||
          nativeSourceUri === lastNavigationUrlRef.current)
      ) {
        // Android ignores a source equal to the URL it already shows.
        return;
      }
      // Runs before the native view can emit events for this source.
      beginAndroidAvailabilityAttempt(nativeSourceUri);
    }, [
      beginAndroidAvailabilityAttempt,
      isAndroidWebView,
      nativeSourceUri,
      webViewKey,
    ]);

    const onRefresh = useCallback(() => {
      if (isUnmountingRef.current) return;
      beginAndroidReloadAttempt();
      webviewRef.current?.reload();
    }, [beginAndroidReloadAttempt]);

    // Cleanup WebView on unmount to prevent native crashes during navigation
    useEffect(() => {
      // Capture webview ref in effect scope to satisfy exhaustive-deps
      const webview = webviewRef.current;

      return () => {
        isUnmountingRef.current = true;
        clearLoadTimeout();
        clearPendingAndroidLoadOk();
        clearAndroidAttemptDeadline();
        reportWebViewAvailabilityResult({
          status: 'cancelled',
          timing: availabilityTimingRef.current,
        });

        try {
          // Stop WebView loading before component unmounts
          webview?.stopLoading();
        } catch (error) {
          // Ignore errors during cleanup - native resources may already be freed
          console.log('NativeWebView cleanup error:', error);
        }
      };
    }, [
      clearAndroidAttemptDeadline,
      clearLoadTimeout,
      clearPendingAndroidLoadOk,
    ]);

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
        // Skip bridge receive when bridge is disabled (content-only overlay).
        // The injected provider script is also absent in this mode, so this
        // is a defense-in-depth guard against direct postMessage calls.
        if (!disableBridge) {
          try {
            const origin = uriUtils.getOriginFromUrl({ url: url || src });
            if (origin) {
              jsBridge.receive(data, { origin });
            }
          } catch (_error) {
            // noop
          }
        }
        onMessage?.(event);
      },
      [disableBridge, jsBridge, onMessage, src],
    );

    useImperativeHandle(ref, (): IWebViewWrapperRef => {
      const wrapper = {
        innerRef: webviewRef.current,
        jsBridge,
        reload: () => {
          beginAndroidReloadAttempt();
          return webviewRef.current?.reload();
        },
        loadURL: (url: string) => {
          if (isAndroidWebView && webviewRef.current) {
            beginAndroidAvailabilityAttempt(url);
          }
          return webviewRef.current?.loadUrl(url);
        },
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
        const { loading, url } = syntheticEvent?.nativeEvent;
        setLoadTimeoutError(false);
        const availabilityTiming = availabilityTimingRef.current;
        if (isAndroidWebView) {
          lastNavigationUrlRef.current = url;
          // A commit only follows the attempt (redirect target, normalized or
          // same-document URL); it never starts one, since the pre-commit
          // failures of the same navigation are not observable.
          if (
            availabilityTiming &&
            !availabilityTiming.reported &&
            pendingAndroidLoadOkTimerRef.current === undefined
          ) {
            availabilityTiming.url = url;
            reportMatchingMainFrameHttpError(availabilityTiming, url);
          }
        } else if (availabilityTiming && !availabilityTiming.reported) {
          // Redirects and quick re-navigation continue the same attempt.
          availabilityTiming.url = url;
        } else if (!useGeckoView) {
          // GeckoView has no success signal wired here; no data beats wrong data.
          availabilityTimingRef.current = createWebViewAvailabilityTiming({
            url,
          });
        }
        if (isAndroidWebView && loading === false) {
          // Android WebView reports same-document history updates as load-start
          // events without a matching load-end event.
          clearLoadTimeout();
        } else {
          startLoadTimeout();
        }

        try {
          if (checkOneKeyCardGoogleOauthUrl({ url })) {
            // Google OAuth rejects embedded browser UAs (disallowed_useragent).
            openUrlExternal(url, { useSystemBrowser: true });
            webviewRef.current?.stopLoading();
          }
          onLoadStart?.(syntheticEvent);
        } catch (error) {
          // debugLogger.webview.error('onLoadStart', error);
          console.log('onLoadStart: ', error);
        }
      },
      [
        clearLoadTimeout,
        isAndroidWebView,
        onLoadStart,
        reportMatchingMainFrameHttpError,
        startLoadTimeout,
        useGeckoView,
      ],
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
                beginAndroidReloadAttempt();
                webviewRef.current?.reload();
              }}
            />
          </Stack>
        );
      },
      [beginAndroidReloadAttempt, src],
    );

    const [devSettings] = useDevSettingsPersistAtom();

    const renderLoading = useCallback(() => <Stack />, []);

    // Wrap callbacks with unmount guard to prevent crashes
    const safeOnLoadProgress = useCallback(
      (event: WebViewProgressEvent) => {
        if (isUnmountingRef.current) return;
        if (isAndroidWebView && event.nativeEvent.progress === 1) {
          const progressUrl = event.nativeEvent.url as string | null;
          if (progressUrl === null) {
            clearPendingAndroidLoadOk();
            reportWebViewAvailabilityResult({
              errorCode: ANDROID_CONNECTION_FAILED_ERROR_CODE,
              status: 'network_error',
              timing: availabilityTimingRef.current,
            });
            clearAndroidAttemptDeadline();
          }
        }
        onLoadProgress?.(event);
      },
      [
        clearAndroidAttemptDeadline,
        clearPendingAndroidLoadOk,
        isAndroidWebView,
        onLoadProgress,
      ],
    );

    const scheduleAndroidLoadOk = useCallback(
      (url: string) => {
        const availabilityTiming = availabilityTimingRef.current;
        // Aborted navigations (blocked URL, stopLoading) also emit a finish
        // event, carrying the aborted URL.
        if (
          !availabilityTiming ||
          availabilityTiming.reported ||
          availabilityTiming.url !== url
        ) {
          return;
        }
        clearPendingAndroidLoadOk();
        // A failed load emits this finish event and then onError in the same
        // native call, so the error cancels this timer before it runs.
        const timer = setTimeout(() => {
          if (pendingAndroidLoadOkTimerRef.current !== timer) {
            return;
          }
          pendingAndroidLoadOkTimerRef.current = undefined;
          if (
            availabilityTiming.reported ||
            availabilityTiming !== availabilityTimingRef.current
          ) {
            return;
          }
          if (!reportMatchingMainFrameHttpError(availabilityTiming, url)) {
            reportWebViewAvailabilityResult({
              status: 'ok',
              timing: availabilityTiming,
            });
            clearAndroidAttemptDeadline();
          }
        }, 0);
        pendingAndroidLoadOkTimerRef.current = timer;
      },
      [
        clearAndroidAttemptDeadline,
        clearPendingAndroidLoadOk,
        reportMatchingMainFrameHttpError,
      ],
    );

    const safeOnLoad = useCallback(
      (event: WebViewNavigationEvent) => {
        if (isUnmountingRef.current) return;
        clearLoadTimeout();
        setLoadTimeoutError(false);
        if (isAndroidWebView) {
          scheduleAndroidLoadOk(event.nativeEvent.url);
        } else {
          reportWebViewAvailabilityResult({
            status: 'ok',
            timing: availabilityTimingRef.current,
          });
        }
        onLoad?.(event);
      },
      [clearLoadTimeout, isAndroidWebView, onLoad, scheduleAndroidLoadOk],
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

    const webViewOnError = useCallback(
      (event: WebViewErrorEvent) => {
        if (isAndroidWebView) {
          clearPendingAndroidLoadOk();
          lastMainFrameHttpErrorRef.current = undefined;
          // The error page commits with the failing URL.
          lastNavigationUrlRef.current = event.nativeEvent.url;
        }
        reportWebViewAvailabilityResult({
          errorCode: event.nativeEvent.code,
          status: 'network_error',
          timing: availabilityTimingRef.current,
        });
        clearAndroidAttemptDeadline();
        onError?.(event);
      },
      [
        clearAndroidAttemptDeadline,
        clearPendingAndroidLoadOk,
        isAndroidWebView,
        onError,
      ],
    );

    const webViewOnHttpError = useCallback(
      (event: WebViewHttpErrorEvent) => {
        const { statusCode, url } = event.nativeEvent;
        const availabilityTiming = availabilityTimingRef.current;
        if (url === availabilityTiming?.url) {
          reportWebViewAvailabilityResult({
            errorCode: statusCode,
            status: 'http_error',
            timing: availabilityTiming,
          });
          clearAndroidAttemptDeadline();
        } else if (isAndroidWebView) {
          // Kept for the commit that moves the attempt to this URL.
          lastMainFrameHttpErrorRef.current = { statusCode, url };
        }
        onHttpError?.(event);
      },
      [clearAndroidAttemptDeadline, isAndroidWebView, onHttpError],
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
        reportWebViewRenderProcessGone({
          didCrash,
          url: availabilityTimingRef.current?.url ?? src,
        });
        // The remounted WebView starts a fresh attempt.
        clearPendingAndroidLoadOk();
        clearAndroidAttemptDeadline();
        lastMainFrameHttpErrorRef.current = undefined;
        availabilityTimingRef.current = undefined;
        // Bump key to force React to unmount the dead WebView and mount a fresh one
        setWebViewKey((prev) => prev + 1);
      },
      [clearAndroidAttemptDeadline, clearPendingAndroidLoadOk, src],
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
            style={[styles.container, style]}
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
          // the video element must also include the `playsinline` attribute
          allowsInlineMediaPlayback
          // disable video autoplay
          mediaPlaybackRequiresUserAction
          source={{ uri: src }}
          onMessage={webviewOnMessage}
          onLoadStart={webViewOnLoadStart}
          onLoad={safeOnLoad}
          onLoadEnd={safeOnLoadEnd}
          onError={webViewOnError}
          onHttpError={webViewOnHttpError}
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
      style,
      containerStyle,
      props,
      pullToRefreshEnabled,
      renderError,
      renderLoading,
      src,
      useGeckoView,
      webViewKey,
      webViewOnError,
      webViewOnHttpError,
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
            beginAndroidReloadAttempt();
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
NativeWebView.displayName = 'NativeWebView';

export { NativeWebView };
