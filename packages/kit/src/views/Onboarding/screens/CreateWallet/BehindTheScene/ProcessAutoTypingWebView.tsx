import { forwardRef, useCallback, useImperativeHandle, useRef } from 'react';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { WebViewWebEmbed } from '../../../../../components/WebView/WebViewWebEmbed';

import { ONBOARDING_WEBVIEW_METHODS } from './consts';

import type {
  IProcessAutoTypingProps,
  IProcessAutoTypingRef,
} from './ProcessAutoTyping';
import type { JsBridgeBase } from '@onekeyfe/cross-inpage-provider-core';
import type {
  IJsBridgeReceiveHandler,
  IJsonRpcRequest,
} from '@onekeyfe/cross-inpage-provider-types';
import type { IWebViewWrapperRef } from '@onekeyfe/onekey-cross-webview';

export type IProcessAutoTypingWebViewProps = IProcessAutoTypingProps & {
  onContentLoaded?: () => void; // currently works in NativeWebView only
};
function ProcessAutoTypingWebView(props: IProcessAutoTypingWebViewProps) {
  const { onPressFinished, forwardedRef, pausedProcessIndex, onContentLoaded } =
    props;
  const webviewRef = useRef<IWebViewWrapperRef | null>(null);
  const receiveHandler = useCallback<IJsBridgeReceiveHandler>(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    (payload, hostBridge: JsBridgeBase) => {
      const req = payload.data as IJsonRpcRequest | undefined;
      if (
        payload.scope === '$private' &&
        req?.method === ONBOARDING_WEBVIEW_METHODS.onboardingPressFinishButton
      ) {
        onPressFinished();
      }
    },
    [onPressFinished],
  );
  const onWebViewRef = useCallback((ref: IWebViewWrapperRef | null) => {
    webviewRef.current = ref;
  }, []);

  const handleWalletCreated = useCallback(() => {
    webviewRef.current?.jsBridge?.request({
      data: {
        method: ONBOARDING_WEBVIEW_METHODS.onboardingWalletCreated,
      },
      scope: '$private',
    });
  }, []);

  useImperativeHandle(
    forwardedRef,
    (): IProcessAutoTypingRef => ({
      handleWalletCreated,
    }),
  );

  const routePath = `/onboarding/auto_typing?pausedProcessIndex=${
    pausedProcessIndex ?? 1
  }`;
  return (
    <WebViewWebEmbed
      isSpinnerLoading
      onContentLoaded={onContentLoaded}
      onWebViewRef={onWebViewRef}
      customReceiveHandler={receiveHandler}
      // *** use web-embed local html file
      routePath={routePath}
      // *** use remote url
      src={
        platformEnv.isDev
          ? `http://192.168.0.104:3008/#${routePath}` // yarn web-embed
          : undefined
      }
    />
  );
}

const ProcessAutoTypingWebViewRef = forwardRef<
  IProcessAutoTypingRef,
  IProcessAutoTypingWebViewProps
>(({ ...props }, ref) => (
  <ProcessAutoTypingWebView {...props} forwardedRef={ref} />
));

ProcessAutoTypingWebViewRef.displayName = 'ProcessAutoTypingWebViewRef';

export default ProcessAutoTypingWebViewRef;
