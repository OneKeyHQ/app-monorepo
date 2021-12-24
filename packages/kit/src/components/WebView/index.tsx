/* eslint-disable @typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-unused-vars */
import React, { useEffect, useState } from 'react';

import { Box, Button, HStack, Select, VStack } from '@onekeyhq/components';
import { IJsBridgeMessagePayload } from '@onekeyhq/inpage-provider/src/types';
import InpageProviderWebView from '@onekeyhq/inpage-provider/src/webview/InpageProviderWebView';
import useWebViewBridge from '@onekeyhq/inpage-provider/src/webview/useWebViewBridge';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
// TODO remove: ui should use walletApi by backgroundApiProxy
import walletApi from '../../background/instance/walletApi';

const { isDesktop, isExtension } = platformEnv;

const srcList = [
  'https://app.uniswap.org/#/swap',
  'https://swap.onekey.so/#/swap',
  'https://4v495.csb.app/',
];

function WebView({
  src,
  showDemoActions = false,
  showWalletActions = false,
}: {
  src: string;
  showDemoActions?: boolean;
  showWalletActions?: boolean;
}): JSX.Element {
  const [srcLocal, setSrcLocal] = useState(src || srcList[0]);
  const [name, setName] = useState('');
  const [resName, setResName] = useState('');
  const { jsBridge, webviewRef, setWebViewRef } = useWebViewBridge();
  const [webviewVisible, setWebViewVisible] = useState(true);
  useEffect(() => {
    if (!jsBridge) {
      return;
    }
    backgroundApiProxy.connectBridge(jsBridge);
    const onMessage = (event: IJsBridgeMessagePayload) => {
      console.log('jsBridge onMessage', event);
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
      // TODO off event
      jsBridge.off('message', onMessage);
    };
  }, [jsBridge]);

  const showActionsAndDemoPanel = showWalletActions || showDemoActions;
  return (
    <Box flex={1}>
      {showActionsAndDemoPanel && (
        <VStack p={2} space={2} zIndex={2} bgColor="white">
          {showWalletActions && (
            <HStack space={2}>
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
                    setResName(
                      (res as { onekeyNameRes: string })?.onekeyNameRes,
                    );
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
