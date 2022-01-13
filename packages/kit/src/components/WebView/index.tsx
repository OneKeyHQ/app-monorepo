/* eslint-disable @typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-unused-vars */
import React, { useEffect, useState } from 'react';

import { useIsFocused } from '@react-navigation/native';

import {
  Box,
  Button,
  Center,
  HStack,
  Select,
  VStack,
} from '@onekeyhq/components';
import { IJsBridgeMessagePayload } from '@onekeyhq/inpage-provider/src/types';
import InpageProviderWebView from '@onekeyhq/inpage-provider/src/webview/InpageProviderWebView';
import useWebViewBridge from '@onekeyhq/inpage-provider/src/webview/useWebViewBridge';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
// TODO remove: ui should use walletApi by backgroundApiProxy
import walletApi from '../../background/instance/walletApi';
import extUtils from '../../utils/extUtils';

const { isDesktop, isExtension } = platformEnv;

const srcList = [
  'https://app.uniswap.org/#/swap',
  'https://swap.onekey.so/#/swap',
  'https://4v495.csb.app/',
];

function WebView({
  src,
  openUrlInExt = false,
  showDemoActions = false,
  showWalletActions = false,
}: {
  src: string;
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
        <Button onPress={() => extUtils.openUrl(src)}>Open</Button>
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
                defaultValue={walletApi.chainId}
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
                defaultValue={walletApi.selectedAddress}
                onChange={(value) => {
                  // TODO only notify to Dapp when isConnected?
                  const selectedAddress = value;
                  backgroundApiProxy.changeAccounts(selectedAddress);
                }}
                options={walletApi.accounts.map((address: string) => ({
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

          {showDemoActions && (
            <VStack space={2}>
              <Button
                size="sm"
                onPress={() => setWebViewVisible(!webviewVisible)}
              >
                Toggle WebView Visible
              </Button>

              <Box zIndex={2}>
                <Select
                  containerProps={{
                    width: '360px',
                    zIndex: 999,
                  }}
                  value={srcLocal}
                  onChange={(v) => setSrcLocal(v)}
                  options={srcList.map((uri) => ({
                    value: uri,
                    label: uri,
                  }))}
                />
              </Box>

              <HStack space={2}>
                <Button
                  onPress={() => {
                    walletApi.isConnected = false;
                    jsBridge?.request({
                      data: {
                        method: 'metamask_accountsChanged',
                        params: [],
                      },
                    });
                  }}
                >
                  disconnect 888
                </Button>
                <Button
                  onPress={() => {
                    walletApi.isConnected = true;
                    jsBridge?.request({
                      data: {
                        method: 'metamask_accountsChanged',
                        params: [walletApi.selectedAddress],
                      },
                    });
                    jsBridge?.request({
                      data: {
                        method: 'metamask_chainChanged',
                        params: {
                          chainId: walletApi.chainId,
                          networkVersion: '1',
                        },
                      },
                    });
                  }}
                >
                  connect
                </Button>

                <Button
                  onPress={async () => {
                    if (!jsBridge) {
                      return;
                    }
                    console.log('11111');
                    const newName = `Desktop OneKey-${Date.now()
                      .toString()
                      .slice(-4)}`;
                    setName(newName);
                    setResName('');
                    const res = await jsBridge.request({
                      data: {
                        onekeyName: newName,
                      },
                    });
                    // @ts-ignore
                    setResName(res?.onekeyNameRes);
                  }}
                >
                  requestToInpage
                </Button>
              </HStack>
              <Box>request: {name}</Box>
              <Box>response: {resName}</Box>
            </VStack>
          )}
        </VStack>
      )}

      <Box flex={1}>
        {webviewVisible && srcLocal && (
          <InpageProviderWebView
            key={srcLocal}
            ref={setWebViewRef}
            src={srcLocal}
            receiveHandler={backgroundApiProxy.bridgeReceiveHandler}
          />
        )}
      </Box>
    </Box>
  );
}

export default WebView;
