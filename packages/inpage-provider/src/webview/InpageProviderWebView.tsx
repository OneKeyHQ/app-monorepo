import React, { FC, forwardRef, useImperativeHandle } from 'react';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { IJsBridgeReceiveHandler } from '../types';

import DesktopWebView from './DesktopWebView';
import NativeWebView from './NativeWebView';
import useWebViewBridge, { IWebViewWrapperRef } from './useWebViewBridge';

const { isDesktop, isWeb, isExtension, isNative } = platformEnv;
const isApp = isNative;

export type InpageProviderWebViewProps = {
  src?: string;
  receiveHandler: IJsBridgeReceiveHandler;
};

const InpageProviderWebView: FC<InpageProviderWebViewProps> = forwardRef(
  ({ src = '', receiveHandler }: InpageProviderWebViewProps, ref: any) => {
    const { webviewRef, setWebViewRef } = useWebViewBridge();

    useImperativeHandle(
      ref,
      (): IWebViewWrapperRef | null => webviewRef.current,
    );

    return (
      <>
        {isDesktop && (
          <DesktopWebView
            src={src}
            ref={setWebViewRef}
            receiveHandler={receiveHandler}
          />
        )}
        {isApp && (
          <NativeWebView
            src={src}
            ref={setWebViewRef}
            receiveHandler={receiveHandler}
          />
        )}
        {(isWeb || isExtension) && (
          <iframe
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
