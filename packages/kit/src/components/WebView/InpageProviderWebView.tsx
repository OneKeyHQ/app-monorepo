import type { FC } from 'react';
import { forwardRef, useImperativeHandle, useRef } from 'react';

import type { InpageProviderWebViewProps } from './types';
import type { IWebViewWrapperRef } from '@onekeyfe/onekey-cross-webview';

const InpageProviderWebView: FC<InpageProviderWebViewProps> = forwardRef(
  ({ src = '', scrolling }: InpageProviderWebViewProps, ref: any) => {
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

    useImperativeHandle(
      ref,
      (): IWebViewWrapperRef | null => iframeWebviewRef.current,
    );

    return (
      <iframe
        ref={iframeRef}
        title="iframe-web"
        src={src}
        frameBorder="0"
        scrolling={scrolling}
        style={{ height: '100%', width: '100%' }}
      />
    );
  },
);
InpageProviderWebView.displayName = 'InpageProviderWebView';

export default InpageProviderWebView;
