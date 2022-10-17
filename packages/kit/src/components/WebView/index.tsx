import { ComponentProps, useCallback } from 'react';

import { IJsBridgeReceiveHandler } from '@onekeyfe/cross-inpage-provider-types';
import { IWebViewWrapperRef } from '@onekeyfe/onekey-cross-webview';
import {
  WebViewNavigation,
  WebViewSource,
} from 'react-native-webview/lib/WebViewTypes';

import { Box, Button, Center } from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import extUtils from '../../utils/extUtils';

import InpageProviderWebView from './InpageProviderWebView';

function WebView({
  src,
  onSrcChange,
  openUrlInExt = false,
  onWebViewRef,
  onNavigationStateChange,
  allowpopups = false,
  containerProps,
  customReceiveHandler,
  nativeWebviewSource,
  nativeInjectedJavaScriptBeforeContentLoaded,
  isSpinnerLoading,
  onContentLoaded,
}: {
  src: string;
  onSrcChange?: (src: string) => void;
  openUrlInExt?: boolean;
  onWebViewRef?: (ref: IWebViewWrapperRef | null) => void;
  onNavigationStateChange?: (event: WebViewNavigation) => void;
  allowpopups?: boolean;
  containerProps?: ComponentProps<typeof Box>;
  customReceiveHandler?: IJsBridgeReceiveHandler;
  nativeWebviewSource?: WebViewSource | undefined;
  nativeInjectedJavaScriptBeforeContentLoaded?: string;
  isSpinnerLoading?: boolean;
  onContentLoaded?: () => void; // currently works in NativeWebView only
}): JSX.Element {
  const receiveHandler = useCallback<IJsBridgeReceiveHandler>(
    async (payload, hostBridge) => {
      const result = await backgroundApiProxy.bridgeReceiveHandler(payload);

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
      {Boolean(src || nativeWebviewSource) && (
        <InpageProviderWebView
          ref={(ref: IWebViewWrapperRef | null) => {
            if (ref) {
              onWebViewRef?.(ref);
            }
          }}
          src={src}
          isSpinnerLoading={isSpinnerLoading}
          onSrcChange={onSrcChange}
          receiveHandler={receiveHandler}
          onNavigationStateChange={onNavigationStateChange}
          allowpopups={allowpopups}
          nativeWebviewSource={nativeWebviewSource}
          nativeInjectedJavaScriptBeforeContentLoaded={
            nativeInjectedJavaScriptBeforeContentLoaded
          }
          // currently works in NativeWebView only
          onContentLoaded={onContentLoaded}
        />
      )}
    </Box>
  );
}

export default WebView;
