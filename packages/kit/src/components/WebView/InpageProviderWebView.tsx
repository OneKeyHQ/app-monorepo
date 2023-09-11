import type { FC } from 'react';
import { forwardRef, useImperativeHandle, useRef } from 'react';

import type { InpageProviderWebViewProps } from './types';
import type { IWebViewWrapperRef } from '@onekeyfe/onekey-cross-webview';

const InpageProviderWebView: FC<InpageProviderWebViewProps> = forwardRef(
  ({ src = '' }: InpageProviderWebViewProps, ref: any) => {
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
        style={{ height: '100%', width: '100%' }}
        // https://developer.mozilla.org/en-US/docs/Web/HTML/Element/iframe#attr-sandbox
        // sandbox="allow-downloads allow-downloads-without-user-activation allow-forms allow-modals allow-orientation-lock allow-pointer-lock allow-popups allow-popups-to-escape-sandbox allow-presentation allow-same-origin allow-scripts allow-storage-access-by-user-activation "
        // sandbox="allow-scripts"
        // not working
      />
    );
  },
);
InpageProviderWebView.displayName = 'InpageProviderWebView';

export default InpageProviderWebView;
