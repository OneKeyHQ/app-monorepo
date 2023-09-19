import type { FC } from 'react';
import { forwardRef, useImperativeHandle, useMemo, useState } from 'react';

import { useWebViewBridge } from '@onekeyfe/onekey-cross-webview';
import { Box, Progress } from 'native-base';

import { Center, Spinner } from '@onekeyhq/components';

// injected hot-reload cache update: 213344000887463332
// eslint-disable-next-line import/order
// @ts-ignore
import injectedNativeCode from './injectedNative.text-js';
import { NativeWebView } from './NativeWebView';

import type { InpageProviderWebViewProps } from './types';
import type { IWebViewWrapperRef } from '@onekeyfe/onekey-cross-webview';
import type { WebViewProps } from 'react-native-webview';

if (process.env.NODE_ENV !== 'production') {
  console.log(`injected hot-reload cache update: 0038743333`);
}

const InpageProviderWebView: FC<InpageProviderWebViewProps> = forwardRef(
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
      androidLayerType,
    }: InpageProviderWebViewProps,
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
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
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
            ${nativeInjectedJavaScriptBeforeContentLoaded}
            ;
        })();
        `;
      }
      return code;
    }, [nativeInjectedJavaScriptBeforeContentLoaded]);

    const progressLoading = useMemo(() => {
      if (progress < 100) {
        if (isSpinnerLoading) {
          // should be absolute position, otherwise android will crashed!
          return (
            <Center
              position="absolute"
              left={0}
              top={0}
              right={0}
              w="full"
              h="full"
              flex={1}
            >
              <Spinner size="lg" />
            </Center>
          );
        }
        return (
          <Progress
            value={progress}
            position="absolute"
            left={0}
            top={0}
            right={0}
            zIndex={10}
            rounded={0}
            size="xs"
            bg="surface-neutral-default"
            _filledTrack={{
              bg: 'interactive-default',
            }}
          />
        );
      }
      return null;
    }, [isSpinnerLoading, progress]);

    return (
      <Box flex={1}>
        {progressLoading}
        <NativeWebView
          ref={setWebViewRef}
          src={src}
          onSrcChange={onSrcChange}
          receiveHandler={receiveHandler}
          injectedJavaScriptBeforeContentLoaded={nativeInjectedJsCode}
          onLoadProgress={({ nativeEvent }) => {
            const p = Math.ceil(nativeEvent.progress * 100);
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            setProgress(p);
            if (p >= 100) {
              onContentLoaded?.();
            }
          }}
          onNavigationStateChange={onNavigationStateChange}
          onShouldStartLoadWithRequest={onShouldStartLoadWithRequest}
          textInteractionEnabled={undefined}
          minimumFontSize={undefined}
          // allowFileAccessFromFileURLs
          // allowFileAccess
          // allowUniversalAccessFromFileURLs

          // *** Note that static HTML will require setting originWhitelist to ["*"].
          originWhitelist={['*']}
          {...nativeWebviewProps}
        />
      </Box>
    );
  },
);
InpageProviderWebView.displayName = 'InpageProviderWebView';

export default InpageProviderWebView;
