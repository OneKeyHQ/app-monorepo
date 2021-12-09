import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Button } from '@onekeyhq/components';
import useIsIpcReady from '../jsBridge/useIsIpcReady';
import createJsBridgeHost from '../jsBridge/createJsBridgeHost';
import { JS_BRIDGE_MESSAGE_IPC_CHANNEL } from '../consts';
import { IElectronWebViewRef } from '../types';

const IS_BROWSER_SIDE = typeof window !== 'undefined';

function usePreloadJsUrl() {
  const { preloadJsUrl } = window.ONEKEY_DESKTOP_GLOBALS;
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

const DesktopWebView = forwardRef(({ src }: { src: string }, ref) => {
  const [isWebviewReady, setIsWebviewReady] = useState(false);
  const webviewRef = useRef<IElectronWebViewRef | null>(null);
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
      createJsBridgeHost({
        webviewRef,
        isElectron: true,
      }),
    [],
  );

  useImperativeHandle(ref, () => ({
    innerRef: webviewRef,
    jsBridge,
  }));

  const initWebviewByRef = useCallback(($ref) => {
    webviewRef.current = $ref as IElectronWebViewRef;
    setIsWebviewReady(true);
  }, []);

  useEffect(() => {
    const webview = webviewRef.current;
    if (!webview || !isIpcReady || !isWebviewReady) {
      return;
    }
    const handleMessage = (event: { channel: string; args: Array<string> }) => {
      if (event.channel === JS_BRIDGE_MESSAGE_IPC_CHANNEL) {
        const data: string = event?.args?.[0];
        // - receive
        jsBridge.receive(data);
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
      <Button
        onPress={() => {
          setDevToolsAtLeft(!devToolsAtLeft);
          webviewRef.current?.openDevTools();
        }}
      >
        DevTools
      </Button>

      {/* <div ref={ref} className="webview-container" /> */}
      {IS_BROWSER_SIDE && (
        <webview
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
});
DesktopWebView.displayName = 'DesktopWebView';

export default DesktopWebView;
