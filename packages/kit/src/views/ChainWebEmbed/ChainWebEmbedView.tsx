import type { ComponentProps } from 'react';
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';

import { Pressable } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { WebViewWebEmbed } from '@onekeyhq/kit/src/components/WebView/WebViewWebEmbed';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { useShowWebEmbedWebviewAgent } from '../../hooks/useSettingsDevMode';

import type { IWebViewWrapperRef } from '@onekeyfe/onekey-cross-webview';

const ChainWebEmbedView = forwardRef(
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
    const isWebviewReadyRef = useRef(false);
    const [topPosition, setTopPosition] = useState('100px');
    const isWebviewVisible = useShowWebEmbedWebviewAgent();
    useImperativeHandle(ref, () => ({
      innerRef: webviewRef.current,
      checkWebViewReady: () => isWebviewReadyRef.current,
    }));

    useEffect(() => {
      debugLogger.common.debug(`${routePath} Render`);
    }, [routePath]);

    const onWebViewRef = useCallback(($ref: IWebViewWrapperRef | null) => {
      webviewRef.current = $ref;
      isWebviewReadyRef.current = true;
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

    let boxProps: ComponentProps<typeof Pressable> = {
      height: '0px',
      width: '0px',
    };
    if (isWebviewVisible) {
      boxProps = {
        height: '100px',
        width: '300px',
        zIndex: 9999,
        position: 'absolute',
        top: topPosition,
        left: '20px',
        borderColor: 'border-default',
        borderWidth: '5px',
        borderRightWidth: '50px',
        onPress: () => {
          setTopPosition(topPosition === '100px' ? '400px' : '100px');
        },
      };
    }

    return (
      <Pressable {...boxProps}>
        <WebViewWebEmbed
          onWebViewRef={onWebViewRef}
          onContentLoaded={() => {
            debugLogger.common.debug(`${routePath} loaded`);
            isWebviewReadyRef.current = true;
            callback?.();
          }}
          // *** use web-embed local html file
          routePath={routePath}
          // *** use remote url
          src={
            platformEnv.isDev
              ? `http://192.168.31.204:3008/#${routePath}`
              : undefined
          }
        />
      </Pressable>
    );
  },
);

ChainWebEmbedView.displayName = 'ChainWebEmbedView';

export { ChainWebEmbedView };
