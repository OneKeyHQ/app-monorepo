import type { FC } from 'react';
import { forwardRef, useImperativeHandle, useRef } from 'react';

import type { IInpageProviderWebViewProps, IWebViewRef } from './types';
import type { IWebViewWrapperRef } from '@onekeyfe/onekey-cross-webview';

const IsolatedPlatformWebView: FC<IInpageProviderWebViewProps> = forwardRef(
  ({ src = '' }: IInpageProviderWebViewProps, ref: any) => {
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

    useImperativeHandle(ref, () => {
      const wrapper = {
        innerRef: iframeWebviewRef.current,
        reload: () => iframeWebviewRef.current?.reload(),
        loadURL: (url: string) => {
          iframeWebviewRef.current?.loadURL(url);
        },
        sendMessageViaInjectedScript: () => {
          // noop
        },
      };
      return wrapper as unknown as IWebViewRef;
    });

    return (
      <iframe
        ref={iframeRef}
        title="iframe-web-isolated"
        src={src}
        frameBorder="0"
        style={{ height: '100%', width: '100%' }}
      />
    );
  },
);
IsolatedPlatformWebView.displayName = 'IsolatedPlatformWebView';

export default IsolatedPlatformWebView;
