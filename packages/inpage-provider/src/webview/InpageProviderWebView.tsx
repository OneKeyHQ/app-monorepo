import React, { FC, forwardRef, useImperativeHandle, useRef } from 'react';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { InpageProviderWebViewProps } from '../types';

import DesktopWebView from './DesktopWebView';
import NativeWebView from './NativeWebView';
import useWebViewBridge, { IWebViewWrapperRef } from './useWebViewBridge';

const { isDesktop, isWeb, isExtension, isNative } = platformEnv;
const isApp = isNative;

const InpageProviderWebView: FC<InpageProviderWebViewProps> = forwardRef(
  (
    { src = '', onSrcChange, receiveHandler }: InpageProviderWebViewProps,
    ref: any,
  ) => {
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
      <>
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
          />
        )}
        {isRenderAsIframe && (
          // TODO define new IframeSimWebview class
          <iframe
            ref={iframeRef}
            title="iframe-web"
            src={src}
            frameBorder="0"
            style={{ height: '100%', width: '100%' }}
          />
        )}
      </>
    );
  },
);
InpageProviderWebView.displayName = 'InpageProviderWebView';

export default InpageProviderWebView;
