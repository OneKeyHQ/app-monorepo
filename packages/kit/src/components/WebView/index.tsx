import type { ComponentProps, FC } from 'react';
import { useCallback, useRef } from 'react';

import { Box, Button, Center } from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import extUtils from '../../utils/extUtils';
import { getOriginFromUrl, isOriginMatched } from '../../utils/uriUtils';

import InpageProviderWebView from './InpageProviderWebView';

import type { JsBridgeBase } from '@onekeyfe/cross-inpage-provider-core';
import type {
  IElectronWebView,
  IJsBridgeReceiveHandler,
  IJsonRpcRequest,
} from '@onekeyfe/cross-inpage-provider-types';
import type { IWebViewWrapperRef } from '@onekeyfe/onekey-cross-webview';
import type {
  WebViewNavigation,
  WebViewOpenWindowEvent,
  WebViewSource,
} from 'react-native-webview/lib/WebViewTypes';

interface WebViewProps {
  id?: string;
  src?: string;
  onSrcChange?: (src: string) => void;
  openUrlInExt?: boolean;
  onWebViewRef?: (ref: IWebViewWrapperRef | null) => void;
  onNavigationStateChange?: (event: WebViewNavigation) => void;
  onShouldStartLoadWithRequest?: (event: WebViewNavigation) => boolean;
  allowpopups?: boolean;
  containerProps?: ComponentProps<typeof Box>;
  customReceiveHandler?: IJsBridgeReceiveHandler;
  nativeWebviewSource?: WebViewSource | undefined;
  nativeInjectedJavaScriptBeforeContentLoaded?: string;
  isSpinnerLoading?: boolean;
  onContentLoaded?: () => void; // currently works in NativeWebView only
  onOpenWindow?: (event: WebViewOpenWindowEvent) => void;
  androidLayerType?: 'none' | 'software' | 'hardware';
}

const WebView: FC<WebViewProps> = ({
  src = '',
  openUrlInExt = false,
  allowpopups = false,
  onWebViewRef = () => {},
  customReceiveHandler,
  containerProps,
  ...rest
}) => {
  const webviewRef = useRef<IWebViewWrapperRef | null>(null);

  const onWebViewRefFinal = useCallback(
    ($ref: IWebViewWrapperRef | null) => {
      webviewRef.current = $ref;
      onWebViewRef?.($ref);
    },
    [onWebViewRef],
  );

  const receiveHandler = useCallback<IJsBridgeReceiveHandler>(
    async (payload, hostBridge: JsBridgeBase) => {
      const result = await backgroundApiProxy.bridgeReceiveHandler(payload);

      // TODO move to IWebViewWrapperRef.getURL()
      const webviewUrl = platformEnv.isNative
        ? // @ts-ignore
          webviewRef.current?.innerRef?.$$currentWebviewUrl || ''
        : (
            webviewRef.current?.innerRef as IElectronWebView | undefined
          )?.getURL() || '';

      const requestOrigin = getOriginFromUrl({
        url: payload.origin || '',
      });
      const webviewOrigin = getOriginFromUrl({
        url: webviewUrl,
      });
      const hostRemoteOrigin = hostBridge?.remoteInfo.origin || '';

      if (
        (requestOrigin && webviewOrigin && requestOrigin !== webviewOrigin) ||
        (requestOrigin &&
          hostRemoteOrigin &&
          requestOrigin !== hostRemoteOrigin)
      ) {
        let message = `Origin not matched! expected: ${requestOrigin}, actual: ${webviewOrigin} | ${hostRemoteOrigin}`;
        if (process.env.NODE_ENV !== 'production') {
          message += `  >> ${JSON.stringify({
            scope: payload.scope,
            method: (payload.data as IJsonRpcRequest)?.method,
            hostRemoteOrigin,
          })}  `;
        }
        throw new Error(message);
      }

      // return customReceiveHandler() response not supported yet
      await customReceiveHandler?.(payload, hostBridge);

      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
      return result;
    },
    [customReceiveHandler],
  );

  if (
    platformEnv.isExtension &&
    !platformEnv.isExtensionUiExpandTab &&
    openUrlInExt
  ) {
    return (
      <Center flex={1}>
        <Button onPress={() => extUtils.openUrlInTab(src)}>Open</Button>
      </Center>
    );
  }
  return (
    <Box flex={1} bg="background-default" {...containerProps}>
      <InpageProviderWebView
        ref={onWebViewRefFinal}
        src={src}
        allowpopups={allowpopups}
        receiveHandler={receiveHandler}
        {...rest}
      />
    </Box>
  );
};

export default WebView;
