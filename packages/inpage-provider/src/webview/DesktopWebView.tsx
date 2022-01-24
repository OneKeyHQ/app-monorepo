import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';

import { LoadURLOptions } from 'electron';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { JS_BRIDGE_MESSAGE_IPC_CHANNEL } from '../consts';
import JsBridgeDesktopHost from '../jsBridge/JsBridgeDesktopHost';
import useIsIpcReady from '../jsBridge/useIsIpcReady';
import { IElectronWebView, InpageProviderWebViewProps } from '../types';

import { IWebViewWrapperRef } from './useWebViewBridge';

function usePreloadJsUrl() {
  const { preloadJsUrl } = window.ONEKEY_DESKTOP_GLOBALS ?? {};
  useEffect(() => {
    if (preloadJsUrl) {
      return;
    }
    const timer = setTimeout(() => {
      if (!preloadJsUrl) {
        console.error(`Webview render failed:
      Please send messages of channel SET_ONEKEY_DESKTOP_GLOBALS at app start
      `);
      }
    }, 3000);
    return () => clearTimeout(timer);
  }, [preloadJsUrl]);
  return preloadJsUrl as string;
}

// Used for webview type referencing
const WEBVIEW_TAG = 'webview';

const DesktopWebView = forwardRef(
  (
    {
      src,
      receiveHandler,
      onSrcChange,
      ...props
    }: React.ComponentProps<typeof WEBVIEW_TAG> & InpageProviderWebViewProps,
    ref: any,
  ) => {
    const [isWebviewReady, setIsWebviewReady] = useState(false);
    const webviewRef = useRef<IElectronWebView | null>(null);
    const isIpcReady = useIsIpcReady();
    const [devToolsAtLeft, setDevToolsAtLeft] = useState(false);

    useEffect(
      () => () => {
        // not working, ref is null after unmount
        webviewRef.current?.closeDevTools();
      },
      [],
    );

    // TODO extract to hooks
    const jsBridge = useMemo(
      () =>
        new JsBridgeDesktopHost({
          webviewRef,
          receiveHandler,
        }),
      [receiveHandler],
    );

    useImperativeHandle(ref, (): IWebViewWrapperRef => {
      const wrapper = {
        innerRef: webviewRef.current,
        jsBridge,
        reload: () => webviewRef.current?.reload(),
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        loadURL: (url: string, options?: LoadURLOptions) => {
          if (onSrcChange) {
            onSrcChange(url);
          } else {
            console.warn(
              'DesktopWebView: Please pass onSrcChange props to enable loadURL() working.',
            );
          }
          // use onSrcChange props change src
          //    do not need call ElectronWebView.loadURL() manually.
          // webviewRef.current?.loadURL(url);
        },
      };

      jsBridge.webviewWrapper = wrapper;

      return wrapper;
    });

    const initWebviewByRef = useCallback(($ref) => {
      webviewRef.current = $ref as IElectronWebView;
      // desktop "ipc-message" listener must be added after webviewReady
      //    so use ref to check it
      setIsWebviewReady(true);
    }, []);

    useEffect(() => {
      const webview = webviewRef.current;
      if (!webview || !isIpcReady || !isWebviewReady) {
        return;
      }
      const handleMessage = (event: {
        channel: string;
        args: Array<string>;
        target: IElectronWebView;
      }) => {
        if (event.channel === JS_BRIDGE_MESSAGE_IPC_CHANNEL) {
          const data: string = event?.args?.[0];
          let origin = '';
          const url = event.target.getURL();
          // url initial value is empty after webview mounted
          if (url) {
            const uri = new URL(url);
            origin = uri?.origin || '';
            // - receive
            jsBridge.receive(data, { origin });
          }
        }

        // response back
        // webview.send();
      };
      webview.addEventListener('ipc-message', handleMessage);
      return () => {
        webview.removeEventListener('ipc-message', handleMessage);
      };
    }, [jsBridge, isIpcReady, isWebviewReady]);

    const preloadJsUrl = usePreloadJsUrl();

    if (!preloadJsUrl) {
      return null;
    }

    if (!isIpcReady) {
      return null;
    }

    return (
      <>
        {platformEnv.isDev && (
          <button
            type="button"
            style={{
              fontSize: 12,
              padding: 0,
              opacity: 0.6,
              position: 'absolute',
              right: devToolsAtLeft ? undefined : 0,
              left: devToolsAtLeft ? 0 : undefined,
            }}
            onClick={() => {
              setDevToolsAtLeft(!devToolsAtLeft);
              webviewRef.current?.openDevTools();
            }}
          >
            DevTools
          </button>
        )}

        {/* <div ref={ref} className="webview-container" /> */}
        {platformEnv.isBrowser && (
          <webview
            {...props}
            ref={initWebviewByRef}
            preload={preloadJsUrl}
            src={src}
            style={{ 'width': '100%', 'height': '100%' }}
            // @ts-ignore
            allowpopups="true"
            // @ts-ignore
            nodeintegration="true"
            nodeintegrationinsubframes="true"
            webpreferences="contextIsolation=0, contextisolation=0, nativeWindowOpen=1"
            // mobile user-agent
            // useragent="Mozilla/5.0 (iPhone; CPU iPhone OS 13_2_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/13.0.3 Mobile/15E148 Safari/604.1"
          />
        )}
      </>
    );
  },
);
DesktopWebView.displayName = 'DesktopWebView';

export default DesktopWebView;
