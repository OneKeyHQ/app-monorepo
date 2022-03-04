/* eslint-disable @typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-unused-vars */
import React, { useEffect, useState } from 'react';

import { IJsBridgeMessagePayload } from '@onekeyfe/cross-inpage-provider-types';
import { useWebViewBridge } from '@onekeyfe/onekey-cross-webview';
import { useIsFocused } from '@react-navigation/native';

import {
  Box,
  Button,
  Center,
  HStack,
  Select,
  VStack,
} from '@onekeyhq/components';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import extUtils from '../../utils/extUtils';

import InpageProviderWebView from './InpageProviderWebView';

const { isDesktop, isExtension } = platformEnv;

const srcList = [
  'https://app.uniswap.org/#/swap',
  'https://swap.onekey.so/#/swap',
  'https://4v495.csb.app/',
];

function WebView({
  src,
  onSrcChange,
  openUrlInExt = false,
  showDemoActions = false,
  showWalletActions = false,
}: {
  src: string;
  onSrcChange?: (src: string) => void;
  openUrlInExt?: boolean;
  showDemoActions?: boolean;
  showWalletActions?: boolean;
}): JSX.Element {
  const isFocused = useIsFocused();
  const [srcLocal, setSrcLocal] = useState(src || srcList[0]);
  const [name, setName] = useState('');
  const [resName, setResName] = useState('');
  const { jsBridge, webviewRef, setWebViewRef } = useWebViewBridge();
  const [webviewVisible, setWebViewVisible] = useState(true);
  useEffect(() => {
    if (jsBridge) {
      // only enable message for current focused webview
      jsBridge.globalOnMessageEnabled = isFocused;
    }
  }, [isFocused, jsBridge]);
  useEffect(() => {
    if (!jsBridge || !isFocused) {
      return;
    }
    debugLogger.webview('webview isFocused and connectBridge', src);
    // connect background jsBridge
    backgroundApiProxy.connectBridge(jsBridge);

    // Native App needs instance notify
    if (platformEnv.isNative) {
      debugLogger.webview('webview notify changed events1', src);
      backgroundApiProxy.notifyAccountsChanged();
      backgroundApiProxy.notifyChainChanged();
    }

    // Desktop needs timeout wait for webview DOM ready
    //  FIX: Error: The WebView must be attached to the DOM and the dom-ready event emitted before this method can be called.
    const timer = setTimeout(() => {
      debugLogger.webview('webview notify changed events2', src);
      backgroundApiProxy.notifyAccountsChanged();
      backgroundApiProxy.notifyChainChanged();
    }, 1500);

    const onMessage = (event: IJsBridgeMessagePayload) => {
      if ((event?.data as { method: string })?.method) {
        // handleProviderMethods(jsBridge, event, isApp);
      } else {
        setTimeout(() => {
          if (event && event.resolve) {
            const newName: string = (event?.data as { onekeyName: string })
              ?.onekeyName;
            event.resolve({
              onekeyNameRes: `Hello, ${newName} (from ${
                isDesktop ? 'Desktop' : 'App'
              })`,
            });
          }
        }, 1500);
      }
    };
    // window.webviewJsBridge = jsBridge;
    jsBridge.on('message', onMessage);
    return () => {
      clearTimeout(timer);
      // TODO off event
      jsBridge.off('message', onMessage);
    };
  }, [jsBridge, isFocused, src]);

  const showActionsAndDemoPanel = showWalletActions || showDemoActions;

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
    <Box flex={1} bg="background-default">
      {showActionsAndDemoPanel && (
        <VStack p={2} space={2} zIndex={2} bgColor="white">
          {showWalletActions && (
            <HStack space={2} zIndex={2}>
              <Select
                containerProps={{
                  width: '180px',
                  zIndex: 999,
                }}
                defaultValue="0x1"
                onChange={(value) => {
                  setName(`${Date.now()}`);
                  const chainId = value;
                  backgroundApiProxy.changeChain(chainId);
                }}
                options={['0x1', '0x2', '0x3', '0x4', '0x5', '0x2a'].map(
                  (id) => ({
                    value: id,
                    label: `Chain ${id}`,
                  }),
                )}
              />
              <Select
                containerProps={{
                  width: '180px',
                  zIndex: 999,
                }}
                defaultValue=""
                onChange={(value) => {
                  // TODO only notify to Dapp when isConnected?
                  const selectedAddress = value;
                  backgroundApiProxy.changeAccounts(selectedAddress);
                }}
                options={[].map((address: string) => ({
                  value: address,
                  label: `${address.slice(0, 6)}...${address.slice(-4)}`,
                }))}
              />
              <Button
                size="xs"
                onPress={() => {
                  webviewRef.current?.reload();
                }}
              >
                Reload
              </Button>
            </HStack>
          )}
        </VStack>
      )}

      <Box flex={1}>
        {webviewVisible && src && (
          <InpageProviderWebView
            ref={setWebViewRef}
            src={src}
            onSrcChange={onSrcChange}
            receiveHandler={backgroundApiProxy.bridgeReceiveHandler}
          />
        )}
      </Box>
    </Box>
  );
}

export default WebView;
