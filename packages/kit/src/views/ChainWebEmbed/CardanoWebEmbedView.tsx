import type { ComponentProps } from 'react';
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

import {
  useIsDevModeEnabled,
  useShowWebEmbedWebviewAgent,
} from '../../hooks/useSettingsDevMode';

import type { IWebViewWrapperRef } from '@onekeyfe/onekey-cross-webview';

export const CardanoWebEmbedView = forwardRef(
  (
    {
      callback,
    }: {
      callback: (() => void) | null;
    },
    ref: any,
  ) => {
    const webviewRef = useRef<IWebViewWrapperRef | null>(null);
    const [isWebviewReady, setIsWebViewReady] = useState(false);
    const isWebviewVisible = useShowWebEmbedWebviewAgent();
    useImperativeHandle(ref, () => ({
      innerRef: webviewRef.current,
      checkWebViewReady: () => isWebviewReady,
    }));

    useEffect(() => {
      debugLogger.common.debug('CardanoWebEmbedView Render');
    }, []);

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

    const routePath = '/cardano';


    let boxProps: ComponentProps<typeof Box> = {
      height: '0px',
      width: '0px',
    };
    if (isWebviewVisible) {
      boxProps = {
        height: '100px',
        width: '300px',
        zIndex: 9999,
        position: 'absolute',
        top: '100px',
        left: '20px',
        borderColor: 'border-default',
        borderWidth: '4px',
      };
    }

    return (
      <Box {...boxProps}>
        <WebViewWebEmbed
          onWebViewRef={onWebViewRef}
          onContentLoaded={() => {
            debugLogger.common.debug('CardanoWebEmbedView Loaded');
            setIsWebViewReady(true);
            callback?.();
          }}
          // *** use web-embed local html file
          routePath={routePath}
          // *** use remote url
          src={
            platformEnv.isDev
              ? `http://localhost:3008/#${routePath}`
              : undefined
          }
        />
      </Box>
    );
  },
);

CardanoWebEmbedView.displayName = 'CardanoWebEmbedView';
