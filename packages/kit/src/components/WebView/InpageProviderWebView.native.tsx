import type { FC } from 'react';
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useState,
} from 'react';

import { useWebViewBridge } from '@onekeyfe/onekey-cross-webview';
import { Asset } from 'expo-asset';
import { readAsStringAsync } from 'expo-file-system/legacy';
import { StatusBar } from 'react-native';

import {
  Progress,
  Spinner,
  Stack,
  useKeyboardHeight,
} from '@onekeyhq/components';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { ESiteMode } from '../../views/Discovery/types';

import { NativeWebView } from './NativeWebView';

import type { IInpageProviderWebViewProps } from './types';
import type { IWebViewWrapperRef } from '@onekeyfe/onekey-cross-webview';
import type { WebViewProps } from 'react-native-webview';

const injectedNativeAsset = require('./injectedNative.js.txt') as number;
let injectedNativeCodePromise: Promise<string> | undefined;

function loadInjectedNativeCode() {
  injectedNativeCodePromise ??= Asset.fromModule(injectedNativeAsset)
    .downloadAsync()
    .then((asset) => {
      if (!asset.localUri) {
        throw new OneKeyLocalError(
          'Failed to resolve the injected native asset locally',
        );
      }
      return readAsStringAsync(asset.localUri);
    })
    .catch((error: unknown) => {
      injectedNativeCodePromise = undefined;
      throw error;
    });
  return injectedNativeCodePromise;
}

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

type INativeInpageProviderWebViewProps = IInpageProviderWebViewProps &
  Pick<WebViewProps, 'containerStyle' | 'style'>;

const InpageProviderWebView: FC<INativeInpageProviderWebViewProps> = forwardRef(
  (
    {
      src = '',
      onSrcChange,
      receiveHandler,
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
      siteMode,
      mediaPermissionWhitelist,
      onMessage,
      useGeckoView,
      useInjectedNativeCode = true,
      pullToRefreshEnabled,
      allowsBackForwardNavigationGestures,
      allowFileAccessFromFileURLs,
      allowFileAccess,
      allowingReadAccessToURL,
      onError,
      onHttpError,
      disableBridge,
    }: INativeInpageProviderWebViewProps,
    ref: any,
  ) => {
    const [progress, setProgress] = useState(5);
    const keyboardHeight = useKeyboardHeight();
    const { webviewRef, setWebViewRef } = useWebViewBridge();
    const shouldLoadInjectedNativeCode =
      useInjectedNativeCode && !disableBridge;
    const [injectedNativeCode, setInjectedNativeCode] = useState<string>();
    const [injectedNativeCodeError, setInjectedNativeCodeError] =
      useState<unknown>();

    useEffect(() => {
      if (!shouldLoadInjectedNativeCode || injectedNativeCode) {
        return;
      }

      let isActive = true;
      void loadInjectedNativeCode().then(
        (code) => {
          if (isActive) {
            setInjectedNativeCode(code);
          }
        },
        (error: unknown) => {
          if (isActive) {
            setInjectedNativeCodeError(error);
          }
        },
      );
      return () => {
        isActive = false;
      };
    }, [injectedNativeCode, shouldLoadInjectedNativeCode]);

    useImperativeHandle(
      ref,
      (): IWebViewWrapperRef | null => webviewRef.current,
    );

    const nativeWebviewProps = useMemo(() => {
      const props = {} as WebViewProps;
      if (nativeWebviewSource) {
        props.source = nativeWebviewSource;
      }
      if (onOpenWindow) {
        props.onOpenWindow = onOpenWindow;
      }
      // setting layer type to software may fix some crashes on android
      // https://github.com/react-native-webview/react-native-webview/issues/1915#issuecomment-880989194
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
        // Enable desktop mode by default on iPad
        platformEnv.isNativeIOSPad ? true : siteMode === ESiteMode.desktop,
      [siteMode],
    );

    const nativeInjectedJsCode = useMemo(() => {
      let code: string = shouldLoadInjectedNativeCode
        ? (injectedNativeCode ?? '')
        : '';
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
    }, [
      injectedNativeCode,
      isDesktopMode,
      nativeInjectedJavaScriptBeforeContentLoaded,
      shouldLoadInjectedNativeCode,
    ]);

    const progressLoading = useMemo(() => {
      if (!displayProgressBar) {
        return null;
      }
      if (progress < 100) {
        if (isSpinnerLoading) {
          // should be absolute position, otherwise android will crashed!
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

    if (injectedNativeCodeError) {
      throw injectedNativeCodeError;
    }

    if (shouldLoadInjectedNativeCode && !injectedNativeCode) {
      return (
        <Stack flex={1} alignItems="center" justifyContent="center">
          <Spinner size="large" />
        </Stack>
      );
    }

    return (
      <Stack {...containerStyle}>
        {progressLoading}

        <NativeWebView
          pullToRefreshEnabled={pullToRefreshEnabled}
          scalesPageToFit={!isDesktopMode}
          webviewDebuggingEnabled={webviewDebuggingEnabled}
          ref={setWebViewRef}
          src={src}
          onSrcChange={onSrcChange}
          receiveHandler={disableBridge ? undefined : receiveHandler}
          disableBridge={disableBridge}
          injectedJavaScriptBeforeContentLoaded={nativeInjectedJsCode}
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
          // allowUniversalAccessFromFileURLs
          // *** Note that static HTML will require setting originWhitelist to ["*"].
          originWhitelist={['*']}
          mediaPermissionWhitelist={mediaPermissionWhitelist}
          userAgent={isDesktopMode ? desktopUserAgent : undefined}
          // https://github.com/react-native-webview/react-native-webview/issues/1779
          onMessage={onMessage || defaultOnMessage}
          useGeckoView={useGeckoView}
          allowsBackForwardNavigationGestures={
            allowsBackForwardNavigationGestures
          }
          {...nativeWebviewProps}
          allowingReadAccessToURL={allowingReadAccessToURL}
          onError={onError}
          onHttpError={onHttpError}
        />
      </Stack>
    );
  },
);
InpageProviderWebView.displayName = 'InpageProviderWebView';

export default InpageProviderWebView;
