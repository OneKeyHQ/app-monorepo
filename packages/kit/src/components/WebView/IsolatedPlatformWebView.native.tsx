import type { FC } from 'react';
import { forwardRef, useMemo, useState } from 'react';

import { StatusBar } from 'react-native';

import {
  Progress,
  Spinner,
  Stack,
  useKeyboardHeight,
} from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { ESiteMode } from '../../views/Discovery/types';

import { NativeIsolatedWebView } from './NativeIsolatedWebView';

import type { IInpageProviderWebViewProps } from './types';
import type { WebViewProps } from 'react-native-webview';

const desktopUserAgent = platformEnv.isNativeIOS
  ? 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_7_3) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15'
  : 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_7_3) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const injectedMetaJavaScript = `
  ;(function() {
      const updateMedate = () => {
      const meta = document.createElement('meta');
      meta.setAttribute('content', 'width=device-width, initial-scale=0.5, maximum-scale=2, user-scalable=2'); 
      meta.setAttribute('name', 'viewport');
      document.getElementsByTagName('head')[0].appendChild(meta);
    };
    document.addEventListener("DOMContentLoaded", () => {
      updateMedate();
    });
    updateMedate();
  })();
`;

const defaultOnMessage = (_event: any) => {};

type INativeIsolatedPlatformWebViewProps = IInpageProviderWebViewProps &
  Pick<WebViewProps, 'containerStyle' | 'style' | 'injectedJavaScript'>;

const IsolatedPlatformWebView: FC<INativeIsolatedPlatformWebViewProps> =
  forwardRef(
    (
      {
        src = '',
        onSrcChange,
        onNavigationStateChange,
        onShouldStartLoadWithRequest,
        nativeWebviewSource,
        nativeInjectedJavaScriptBeforeContentLoaded,
        style,
        containerStyle: webViewContainerStyle,
        isSpinnerLoading,
        onContentLoaded,
        onOpenWindow,
        onLoad,
        onLoadStart,
        onLoadEnd,
        onScroll,
        androidLayerType,
        displayProgressBar,
        onProgress,
        webviewDebuggingEnabled,
        recreateOnContentProcessTerminate,
        siteMode,
        mediaPermissionWhitelist,
        onMessage,
        useGeckoView,
        pullToRefreshEnabled,
        allowsBackForwardNavigationGestures,
        allowFileAccessFromFileURLs,
        allowFileAccess,
        allowingReadAccessToURL,
        scrollViewClipsToBounds,
        onError,
        onHttpError,
        injectedJavaScript,
      }: INativeIsolatedPlatformWebViewProps,
      ref: any,
    ) => {
      const [progress, setProgress] = useState(5);
      const keyboardHeight = useKeyboardHeight();

      const nativeWebviewProps = useMemo(() => {
        const props = {} as WebViewProps;
        if (nativeWebviewSource) {
          props.source = nativeWebviewSource;
        }
        if (onOpenWindow) {
          props.onOpenWindow = onOpenWindow;
        }
        props.androidLayerType = androidLayerType;
        props.onShouldStartLoadWithRequest = onShouldStartLoadWithRequest;
        return props;
      }, [
        androidLayerType,
        nativeWebviewSource,
        onOpenWindow,
        onShouldStartLoadWithRequest,
      ]);

      const isDesktopMode = useMemo(
        () =>
          platformEnv.isNativeIOSPad ? true : siteMode === ESiteMode.desktop,
        [siteMode],
      );

      const nativeInjectedJsCode = useMemo(() => {
        let code = '';
        if (nativeInjectedJavaScriptBeforeContentLoaded) {
          code += `
        ;(function() {
            ;
            ${nativeInjectedJavaScriptBeforeContentLoaded ?? ''}
            ;
        })();
        `;
        }
        if (
          platformEnv.isNative &&
          !platformEnv.isNativeIOSPad &&
          isDesktopMode
        ) {
          code += injectedMetaJavaScript;
        }
        return code;
      }, [isDesktopMode, nativeInjectedJavaScriptBeforeContentLoaded]);

      const progressLoading = useMemo(() => {
        if (!displayProgressBar) {
          return null;
        }
        if (progress < 100) {
          if (isSpinnerLoading) {
            return (
              <Stack
                position="absolute"
                left={0}
                top={0}
                right={0}
                w="100%"
                h="100%"
                flex={1}
                alignItems="center"
                justifyContent="center"
              >
                <Spinner size="large" />
              </Stack>
            );
          }
          return (
            <Progress
              value={progress}
              width="100%"
              position="absolute"
              left={0}
              top={0}
              right={0}
              zIndex={10}
              borderRadius={0}
            />
          );
        }
        return null;
      }, [isSpinnerLoading, progress, displayProgressBar]);

      const containerStyle = useMemo(() => {
        if (platformEnv.isNativeAndroid && keyboardHeight > 0) {
          return {
            height: keyboardHeight + (StatusBar.currentHeight || 0) + 60,
          };
        }

        return {
          flex: 1,
        };
      }, [keyboardHeight]);

      return (
        <Stack {...containerStyle}>
          {progressLoading}

          <NativeIsolatedWebView
            pullToRefreshEnabled={pullToRefreshEnabled}
            scalesPageToFit={!isDesktopMode}
            webviewDebuggingEnabled={webviewDebuggingEnabled}
            recreateOnContentProcessTerminate={
              recreateOnContentProcessTerminate
            }
            ref={ref}
            src={src}
            onSrcChange={onSrcChange}
            injectedJavaScriptBeforeContentLoaded={nativeInjectedJsCode}
            injectedJavaScript={injectedJavaScript}
            style={style}
            containerStyle={webViewContainerStyle}
            onLoadProgress={({ nativeEvent }) => {
              const p = Math.ceil(nativeEvent.progress * 100);
              onProgress?.(p);
              setProgress(p);
              if (p >= 100) {
                onContentLoaded?.();
              }
            }}
            onNavigationStateChange={onNavigationStateChange}
            onShouldStartLoadWithRequest={onShouldStartLoadWithRequest}
            textInteractionEnabled={undefined}
            minimumFontSize={undefined}
            onLoad={onLoad}
            onLoadStart={onLoadStart}
            onLoadEnd={onLoadEnd}
            onScroll={onScroll}
            allowFileAccessFromFileURLs={allowFileAccessFromFileURLs}
            allowFileAccess={allowFileAccess}
            originWhitelist={['*']}
            mediaPermissionWhitelist={mediaPermissionWhitelist}
            userAgent={isDesktopMode ? desktopUserAgent : undefined}
            onMessage={onMessage || defaultOnMessage}
            useGeckoView={useGeckoView}
            allowsBackForwardNavigationGestures={
              allowsBackForwardNavigationGestures
            }
            {...nativeWebviewProps}
            allowingReadAccessToURL={allowingReadAccessToURL}
            scrollViewClipsToBounds={scrollViewClipsToBounds}
            onError={onError}
            onHttpError={onHttpError}
          />
        </Stack>
      );
    },
  );
IsolatedPlatformWebView.displayName = 'IsolatedPlatformWebView';

export default IsolatedPlatformWebView;
