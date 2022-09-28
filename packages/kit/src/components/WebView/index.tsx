import { ComponentProps, useCallback, useEffect } from 'react';

import { IJsBridgeReceiveHandler } from '@onekeyfe/cross-inpage-provider-types';
import {
  IWebViewWrapperRef,
  useWebViewBridge,
} from '@onekeyfe/onekey-cross-webview';
import {
  WebViewNavigation,
  WebViewSource,
} from 'react-native-webview/lib/WebViewTypes';

import { Box, Button, Center } from '@onekeyhq/components';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';
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
  // TODO some dapps will call method when Dapp Modal opened, and isFocused will be false
  //    https://app.1inch.io/#/1/swap/ETH/DAI
  // const isFocused = useIsFocused();
  const isFocused = true; // TODO webview isFocused or Dapp Modal isFocused

  const { jsBridge, setWebViewRef } = useWebViewBridge();

  useEffect(() => {
    if (jsBridge) {
      // only enable message for current focused webview
      jsBridge.globalOnMessageEnabled = isFocused;
    }
    if (!jsBridge || !isFocused) {
      return;
    }
    debugLogger.webview.info('webview isFocused and connectBridge', src);
    // connect background jsBridge
    backgroundApiProxy.connectBridge(jsBridge);

    // Native App needs notify immediately
    if (platformEnv.isNative) {
      debugLogger.webview.info('webview notify changed events1', src);
      backgroundApiProxy.serviceAccount.notifyAccountsChanged();
      backgroundApiProxy.serviceNetwork.notifyChainChanged();
    }

    // TODO use webview dom-ready event: https://github.com/electron/electron/blob/main/docs/api/webview-tag.md#methods
    // Desktop needs timeout wait for webview DOM ready
    //  FIX: Error: The WebView must be attached to the DOM and the dom-ready event emitted before this method can be called.
    const timer = setTimeout(() => {
      debugLogger.webview.info('webview notify changed events2', src);
      backgroundApiProxy.serviceAccount.notifyAccountsChanged();
      backgroundApiProxy.serviceNetwork.notifyChainChanged();
    }, 1500);

    return () => {
      clearTimeout(timer);
    };
  }, [jsBridge, isFocused, src]);

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
          // key refresh not working for uniswap
          // key={webviewGlobalKey}
          ref={(ref: IWebViewWrapperRef | null) => {
            if (ref) {
              setWebViewRef(ref);
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
