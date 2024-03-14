import type { FC } from 'react';
import { forwardRef, useImperativeHandle, useMemo, useState } from 'react';

import { useWebViewBridge } from '@onekeyfe/onekey-cross-webview';

import { Progress, Spinner, Stack } from '@onekeyhq/components';

// @ts-expect-error
import injectedNativeCode from './injectedNative.text-js';
import { NativeWebView } from './NativeWebView';

import type { IInpageProviderWebViewProps } from './types';
import type { IWebViewWrapperRef } from '@onekeyfe/onekey-cross-webview';
import type { WebViewProps } from 'react-native-webview';

const InpageProviderWebView: FC<IInpageProviderWebViewProps> = forwardRef(
  (
    {
      src = '',
      onSrcChange,
      receiveHandler,
      onNavigationStateChange,
      onShouldStartLoadWithRequest,
      nativeWebviewSource,
      nativeInjectedJavaScriptBeforeContentLoaded,
      isSpinnerLoading,
      onContentLoaded,
      onOpenWindow,
      onLoad,
      onLoadStart,
      onLoadEnd,
      onScroll,
      androidLayerType,
      webviewHeight,
      displayProgressBar,
      onProgress,
    }: IInpageProviderWebViewProps,
    ref: any,
  ) => {
    const [progress, setProgress] = useState(5);
    const { webviewRef, setWebViewRef } = useWebViewBridge();

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
    const nativeInjectedJsCode = useMemo(() => {
      let code: string = injectedNativeCode || '';
      if (nativeInjectedJavaScriptBeforeContentLoaded) {
        code += `
        ;(function() {
            ;
            ${nativeInjectedJavaScriptBeforeContentLoaded ?? ''}
            ;
        })();
        `;
      }
      return code;
    }, [nativeInjectedJavaScriptBeforeContentLoaded]);

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

    return (
      <Stack flex={1}>
        {progressLoading}
        <NativeWebView
          ref={setWebViewRef}
          src={src}
          webviewHeight={webviewHeight}
          onSrcChange={onSrcChange}
          receiveHandler={receiveHandler}
          injectedJavaScriptBeforeContentLoaded={nativeInjectedJsCode}
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
          // allowFileAccessFromFileURLs
          // allowFileAccess
          // allowUniversalAccessFromFileURLs

          // *** Note that static HTML will require setting originWhitelist to ["*"].
          originWhitelist={['*']}
          {...nativeWebviewProps}
        />
      </Stack>
    );
  },
);
InpageProviderWebView.displayName = 'InpageProviderWebView';

export default InpageProviderWebView;
