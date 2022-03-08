import React, {
  FC,
  forwardRef,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';

import { InpageProviderWebViewProps } from '@onekeyfe/cross-inpage-provider-types';
import {
  DesktopWebView,
  IWebViewWrapperRef,
  NativeWebView,
  useWebViewBridge,
} from '@onekeyfe/onekey-cross-webview';
import { Box, Progress } from 'native-base';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

// @ts-ignore
import injectedNativeCode from './injectedNative.text-js';
// random 11122333333

// console.log('=============', injectedNativeCode);

const { isDesktop, isWeb, isExtension, isNative } = platformEnv;
const isApp = isNative;

const InpageProviderWebView: FC<InpageProviderWebViewProps> = forwardRef(
  (
    { src = '', onSrcChange, receiveHandler }: InpageProviderWebViewProps,
    ref: any,
  ) => {
    const [progress, setProgress] = useState(5);
    const { webviewRef, setWebViewRef } = useWebViewBridge();
    const isRenderAsIframe = isWeb || isExtension;
    const iframeRef = useRef<HTMLIFrameElement>(null);
    const iframeWebviewRef = useRef<IWebViewWrapperRef>({
      reload: () => {
        if (iframeRef.current) {
          iframeRef.current.src = 'about:blank';
          setTimeout(() => {
            if (iframeRef.current) {
              iframeRef.current.src = src;
            }
          }, 150);
        }
      },
      loadURL: () => {
        // noop
      },
    });

    useImperativeHandle(ref, (): IWebViewWrapperRef | null =>
      isRenderAsIframe ? iframeWebviewRef.current : webviewRef.current,
    );

    return (
      <Box flex={1}>
        {isApp && progress < 100 && (
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
        )}
        <Box flex={1}>
          {isDesktop && (
            <DesktopWebView
              ref={setWebViewRef}
              src={src}
              onSrcChange={onSrcChange}
              receiveHandler={receiveHandler}
            />
          )}
          {isApp && (
            <NativeWebView
              ref={setWebViewRef}
              src={src}
              onSrcChange={onSrcChange}
              receiveHandler={receiveHandler}
              injectedJavaScriptBeforeContentLoaded={injectedNativeCode}
              onLoadProgress={({ nativeEvent }) => {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                setProgress(Math.ceil(nativeEvent.progress * 100));
              }}
              textInteractionEnabled={undefined}
              minimumFontSize={undefined}
            />
          )}
          {isRenderAsIframe && (
            // TODO define new IframeSimWebview class
            <iframe
              ref={iframeRef}
              title="iframe-web"
              src={src}
              key={src}
              frameBorder="0"
              style={{ height: '100%', width: '100%' }}
            />
          )}
        </Box>
      </Box>
    );
  },
);
InpageProviderWebView.displayName = 'InpageProviderWebView';

export default InpageProviderWebView;
