/* eslint-disable @typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-unused-vars */
import React, { ComponentProps, useEffect, useState } from 'react';

import {
  IWebViewWrapperRef,
  useWebViewBridge,
} from '@onekeyfe/onekey-cross-webview';
import { useIsFocused } from '@react-navigation/native';

import { Box, Button, Center } from '@onekeyhq/components';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import { useAppSelector } from '../../hooks';
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
}: {
  src: string;
  onSrcChange?: (src: string) => void;
  openUrlInExt?: boolean;
  onWebViewRef?: (ref: IWebViewWrapperRef | null) => void;
  onNavigationStateChange?: (event: any) => void;
  allowpopups?: boolean;
  containerProps?: ComponentProps<typeof Box>;
}): JSX.Element {
  // TODO some dapps will call method when Dapp Modal opened, and isFocused will be false
  //    https://app.1inch.io/#/1/swap/ETH/DAI
  // const isFocused = useIsFocused();
  const isFocused = true; // TODO webview isFocused or Dapp Modal isFocused

  const { jsBridge, webviewRef, setWebViewRef } = useWebViewBridge();
  const [webviewVisible, setWebViewVisible] = useState(true);
  const webviewGlobalKey = useAppSelector((s) => s.status.webviewGlobalKey);

  useEffect(() => {
    onWebViewRef?.(webviewRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onWebViewRef, webviewRef?.current]);

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
      <Box flex={1}>
        {webviewVisible && src && (
          <InpageProviderWebView
            // key refresh not working for uniswap
            // key={webviewGlobalKey}
            ref={setWebViewRef}
            src={src}
            onSrcChange={onSrcChange}
            receiveHandler={backgroundApiProxy.bridgeReceiveHandler}
            onNavigationStateChange={onNavigationStateChange}
            allowpopups={allowpopups}
          />
        )}
      </Box>
    </Box>
  );
}

export default WebView;
