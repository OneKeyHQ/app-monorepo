import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';

import { Box } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { WebViewWebEmbed } from '@onekeyhq/kit/src/components/WebView/WebViewWebEmbed';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import type { IWebViewWrapperRef } from '@onekeyfe/onekey-cross-webview';

export const ChainWebEmbedView = forwardRef(
  (
    {
      routePath,
      callback,
    }: {
      routePath: string;
      callback: (() => void) | null;
    },
    ref: any,
  ) => {
    const webviewRef = useRef<IWebViewWrapperRef | null>(null);
    const [isWebviewReady, setIsWebViewReady] = useState(false);

    useImperativeHandle(ref, () => ({
      innerRef: webviewRef.current,
      checkWebViewReady: () => isWebviewReady,
    }));

    useEffect(() => {
      debugLogger.common.debug(`${routePath} Render`);
    }, [routePath]);

    const onWebViewRef = useCallback(($ref: IWebViewWrapperRef | null) => {
      webviewRef.current = $ref;
      setIsWebViewReady(true);
    }, []);

    useEffect(() => {
      if (!platformEnv.isNative) {
        return;
      }
      const jsBridge = webviewRef?.current?.jsBridge;
      if (!jsBridge) {
        return;
      }
      jsBridge.globalOnMessageEnabled = true;
      backgroundApiProxy.connectWebEmbedBridge(jsBridge);
    }, [webviewRef]);

    return (
      <Box height="0px" width="0px">
        <WebViewWebEmbed
          onWebViewRef={onWebViewRef}
          onContentLoaded={() => {
            debugLogger.common.debug(`${routePath} Loaded`);
            setIsWebViewReady(true);
            callback?.();
          }}
          // *** use web-embed local html file
          routePath={routePath}
          // *** use remote url
          src={
            platformEnv.isDev
              ? `http://192.168.50.36:3008/#${routePath}`
              : undefined
          }
        />
      </Box>
    );
  },
);

ChainWebEmbedView.displayName = 'ChainWebEmbedView';
