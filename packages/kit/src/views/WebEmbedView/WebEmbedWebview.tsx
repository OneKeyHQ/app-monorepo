import type { ComponentProps, ForwardRefRenderFunction } from 'react';
import {
  forwardRef,
  memo,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
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

export type IWebEmbedWebviewProps = {
  routePath: string;
  onContentLoaded?: (() => void) | null;
};
export type IWebEmbedWebviewForwardRef = {
  innerRef: IWebViewWrapperRef | null;
  checkWebViewReady: () => boolean;
};

const WebEmbedWebviewCmp: ForwardRefRenderFunction<
  IWebEmbedWebviewForwardRef,
  IWebEmbedWebviewProps
> = ({ routePath, onContentLoaded }, ref) => {
  const [topPosition, setTopPosition] = useState('100px');
  const isWebviewVisible = useShowWebEmbedWebviewAgent();

  const webviewRef = useRef<IWebViewWrapperRef | null>(null);
  const isWebviewReadyRef = useRef(false);
  useImperativeHandle(ref, () => ({
    innerRef: webviewRef.current,
    checkWebViewReady: () => isWebviewReadyRef.current,
  }));

  const onWebViewRef = useCallback(($ref: IWebViewWrapperRef | null) => {
    webviewRef.current = $ref;
    isWebviewReadyRef.current = true;
  }, []);

  useEffect(() => {
    debugLogger.webview.debug(`WebEmbedWebview: ${routePath} Render`);
  }, [routePath]);

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

  const boxProps: ComponentProps<typeof Pressable> = useMemo(() => {
    if (isWebviewVisible) {
      return {
        height: '500px',
        width: '300px',
        zIndex: 9999,
        position: 'absolute',
        opacity: 0.8,
        top: topPosition,
        left: '20px',
        borderColor: 'border-default',
        borderWidth: '5px',
        borderRightWidth: '50px',
        onPress: () => {
          setTopPosition(topPosition === '100px' ? '700px' : '100px');
        },
      };
    }
    return {
      height: '0px',
      width: '0px',
    };
  }, [isWebviewVisible, topPosition]);

  const onContentLoadedFinal = useCallback(() => {
    debugLogger.webview.debug(`WebEmbedWebview: ${routePath} loaded`);
    isWebviewReadyRef.current = true;
    onContentLoaded?.();
  }, [onContentLoaded, routePath]);

  return (
    <Pressable {...boxProps}>
      <WebViewWebEmbed
        onWebViewRef={onWebViewRef}
        onContentLoaded={onContentLoadedFinal}
        // *** use web-embed local html file
        routePath={routePath}
        // *** use remote url, start dev server first `yarn web-embed`
        src={
          platformEnv.isDev
            ? `http://192.168.31.205:3008/#${routePath}`
            : undefined
        }
      />
    </Pressable>
  );
};

// TODO rename to WebEmbedApiWebview
const WebEmbedWebview = memo(forwardRef(WebEmbedWebviewCmp));
WebEmbedWebview.displayName = 'WebEmbedWebview';

export { WebEmbedWebview };
