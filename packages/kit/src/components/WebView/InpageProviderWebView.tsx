import type { FC } from 'react';
import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';

import type { IInpageProviderWebViewProps, IWebViewRef } from './types';
import type { IWebViewWrapperRef } from '@onekeyfe/onekey-cross-webview';

const InpageProviderWebView: FC<IInpageProviderWebViewProps> = forwardRef(
  ({ src = '', receiveHandler }: IInpageProviderWebViewProps, ref: any) => {
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
        sendMessageViaInjectedScript: (message: any) => {
          if (iframeRef.current?.contentWindow) {
            try {
              iframeRef.current.contentWindow.postMessage(message, '*');
            } catch (error) {
              console.error(
                'Failed to send message via injected script:',
                error,
              );
            }
          }
        },
      };
      return wrapper as IWebViewRef;
    });

    useEffect(() => {
      const handleMessage = async (event: MessageEvent) => {
        try {
          if (event.source !== iframeRef.current?.contentWindow) return;

          let payload: unknown = event.data;
          if (typeof payload === 'string') {
            try {
              payload = JSON.parse(payload);
            } catch {
              // do nothing
            }
          }

          if (receiveHandler) {
            receiveHandler(
              {
                data: payload,
              } as any,
              undefined,
            );
          }
        } catch (error) {
          console.error('Failed to handle message from iframe:', error);
        }
      };

      window.addEventListener('message', handleMessage);
      return () => {
        window.removeEventListener('message', handleMessage);
      };
    }, [receiveHandler]);

    return (
      <iframe
        ref={iframeRef}
        title="iframe-web"
        src={src}
        frameBorder="0"
        style={{ height: '100%', width: '100%' }}
      />
    );
  },
);
InpageProviderWebView.displayName = 'InpageProviderWebView';

export default InpageProviderWebView;
