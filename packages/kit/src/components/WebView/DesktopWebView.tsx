/* eslint-disable @typescript-eslint/ban-ts-comment, @typescript-eslint/no-explicit-any, react/no-unknown-property */
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';

import { consts } from '@onekeyfe/cross-inpage-provider-core';
import {
  IElectronWebView,
  InpageProviderWebViewProps,
} from '@onekeyfe/cross-inpage-provider-types';
import {
  IWebViewWrapperRef,
  JsBridgeDesktopHost,
} from '@onekeyfe/onekey-cross-webview';
import { LoadURLOptions } from 'electron';
import isArray from 'lodash/isArray';
import isEmpty from 'lodash/isEmpty';
import isNil from 'lodash/isNil';
import isPlainObject from 'lodash/isPlainObject';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';

const isDev = process.env.NODE_ENV !== 'production';

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

export function waitAsync(timeout: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, timeout);
  });
}

export async function waitForDataLoaded({
  data,
  wait = 600,
  logName,
  timeout = 0,
}: {
  data: (...args: any) => any;
  wait?: number;
  logName: string;
  timeout?: number;
}) {
  return new Promise<void>((resolve, reject) => {
    (async () => {
      let timeoutReject = false;
      let timer: any = null;
      const getDataArrFunc = ([] as ((...args: any) => any)[]).concat(data);
      if (timeout) {
        timer = setTimeout(() => {
          timeoutReject = true;
        }, timeout);
      }
      // eslint-disable-next-line no-constant-condition
      while (true) {
        let isAllLoaded = true;

        await Promise.all(
          getDataArrFunc.map(async (getData) => {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            const d = await getData();
            if (d === false) {
              isAllLoaded = false;
              return;
            }

            if (isNil(d)) {
              isAllLoaded = false;
              return;
            }

            if (isEmpty(d)) {
              if (isPlainObject(d) || isArray(d)) {
                isAllLoaded = false;
              }
            }
          }),
        );

        if (isAllLoaded || timeoutReject) {
          break;
        }
        await waitAsync(wait);
        if (logName) {
          console.log(`waitForDataLoaded: ${logName}`);
        }
      }
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      clearTimeout(timer);
      if (timeoutReject) {
        reject(new Error(`waitForDataLoaded: ${logName ?? ''} timeout`));
      } else {
        resolve();
      }
    })();
  });
}

const DesktopWebView = forwardRef(
  (
    {
      src,
      style,
      receiveHandler,
      onSrcChange,
      ...props
    }: React.ComponentProps<typeof WEBVIEW_TAG> & InpageProviderWebViewProps,
    ref: any,
  ) => {
    const [isWebviewReady, setIsWebviewReady] = useState(false);
    const webviewRef = useRef<IElectronWebView | null>(null);
    const [devToolsAtLeft, setDevToolsAtLeft] = useState(false);

    if (props.preload) {
      console.warn(
        'DesktopWebView:  custom preload url may disable built-in injected function',
      );
    }

    useEffect(
      () => () => {
        // not working, ref is null after unmount
        webviewRef.current?.closeDevTools();
      },
      [],
    );

    // TODO extract to hooks
    const jsBridgeHost = useMemo(
      () =>
        new JsBridgeDesktopHost({
          webviewRef,
          receiveHandler,
        }),
      [receiveHandler],
    );

    useImperativeHandle(ref as React.Ref<unknown>, (): IWebViewWrapperRef => {
      const wrapper = {
        innerRef: webviewRef.current,
        jsBridge: jsBridgeHost,
        reload: () => webviewRef.current?.reload(),
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        loadURL: (url: string, options?: LoadURLOptions) => {
          if (onSrcChange) {
            onSrcChange(url);
          } else {
            webviewRef.current?.loadURL(url);
          }
        },
      };

      jsBridgeHost.webviewWrapper = wrapper;

      return wrapper;
    });

    const initWebviewByRef = useCallback(($ref: any) => {
      webviewRef.current = $ref as IElectronWebView;
      setIsWebviewReady(true);
    }, []);

    useEffect(() => {
      const webview = webviewRef.current;
      if (!webview || !isWebviewReady) {
        return;
      }

      // only enable message for current focused webview
      jsBridgeHost.globalOnMessageEnabled = true;
      // connect background jsBridge
      backgroundApiProxy.connectBridge(jsBridgeHost);

      const handleMessage = async (event: {
        channel: string;
        args: Array<string>;
        target: IElectronWebView;
      }) => {
        if (event.channel === consts.JS_BRIDGE_MESSAGE_IPC_CHANNEL) {
          const data: string = event?.args?.[0];
          let originInRequest = '';
          try {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            originInRequest = JSON.parse(data)?.origin as string;
          } catch (error) {
            // noop
          } finally {
            // noop
          }
          let origin = '';
          await waitForDataLoaded({
            wait: 600,
            logName: 'DesktopWebView waitForDataLoaded if origin matched',
            timeout: 5000,
            data: () => {
              let originInUrl = '';
              // url initial value is empty after webview mounted first time
              const url1 = event.target.getURL(); // url won't update immediately when goForward or goBack
              const url2 = event.target.src;
              const url3 = src;
              const url = url1 || url2 || url3;
              if (url) {
                try {
                  const uri = new URL(url);
                  originInUrl = uri?.origin || '';
                } catch {
                  // noop
                }
              }
              if (
                originInUrl &&
                originInRequest &&
                originInUrl === originInRequest
              ) {
                origin = originInRequest;
                return true;
              }
              return false;
            },
          }).catch();
          if (origin) {
            // - receive
            jsBridgeHost.receive(data, { origin });
          } else {
            // TODO log error if url is empty
          }
        }

        // response back
        // webview.send();
      };
      webview.addEventListener('ipc-message', handleMessage);
      return () => {
        webview.removeEventListener('ipc-message', handleMessage);
      };
    }, [jsBridgeHost, isWebviewReady, src]);

    const preloadJsUrl = usePreloadJsUrl();

    if (!preloadJsUrl) {
      return null;
    }

    return (
      <>
        {isDev && (
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

        <webview
          ref={initWebviewByRef}
          preload={preloadJsUrl}
          src={src}
          style={{
            'width': '100%',
            'height': '100%',
            ...style,
          }}
          // @ts-ignore
          allowpopups="true"
          // @ts-ignore
          nodeintegration="true"
          nodeintegrationinsubframes="true"
          webpreferences="contextIsolation=0, contextisolation=0, nativeWindowOpen=1"
          // mobile user-agent
          // useragent="Mozilla/5.0 (iPhone; CPU iPhone OS 13_2_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/13.0.3 Mobile/15E148 Safari/604.1"
          {...props}
        />
      </>
    );
  },
);
DesktopWebView.displayName = 'DesktopWebView';

export { DesktopWebView };
