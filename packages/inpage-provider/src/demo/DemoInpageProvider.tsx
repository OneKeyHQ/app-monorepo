// @ts-nocheck
/* eslint-disable @typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-unused-vars */
import React, { useEffect, useState } from 'react';
import { Box, VStack, HStack, Button, Select } from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import DesktopWebView from '../webview/DesktopWebView';
import { IJsBridgeMessagePayload } from '../types';
import useWebViewBridge from '../webview/useWebViewBridge';
import NativeWebView from '../webview/NativeWebView';
import providerApi from './providerApi';

const { isDesktop, isWeb, isExtension, isNative } = platformEnv;
const isApp = isNative;

const srcList = [
  'https://app.uniswap.org/#/swap',
  'https://swap.onekey.so/#/swap',
  'https://4v495.csb.app/',
];

function DemoInpageProvider({
  src = '',
  fullDemo = false,
}: {
  src?: string;
  fullDemo?: boolean;
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
    // window.webviewJsBridge = jsBridge;
    jsBridge.on('message', (event: IJsBridgeMessagePayload) => {
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
    });
    return () => {
      // TODO off event
    };
  }, [jsBridge]);

  return (
    <Box flex={1}>
      <VStack p={2} space={2} bgColor="white">
        <HStack space={2}>
          <Select
            placeholder="Choose Chain"
            minWidth="180"
            defaultValue={providerApi.chainId}
            onValueChange={(value) => {
              setName(`${Date.now()}`);
              providerApi.chainId = value;
              if (isExtension) {
                window.extJsBridgeUiToBg.requestSync({
                  data: {
                    method: 'internal_changeChain',
                    params: providerApi.chainId,
                  },
                });
              } else {
                // TODO only notify to Dapp when isConnected?
                // method === 'metamask_chainChanged' && this.selectedAddress
                // notifyAllConnections
                jsBridge?.requestSync({
                  data: {
                    // metamask_accountsChanged
                    // metamask_unlockStateChanged
                    method: 'metamask_chainChanged',
                    params: {
                      chainId: providerApi.chainId,
                      networkVersion: '1',
                    },
                  },
                });
              }
            }}
          >
            {['0x1', '0x2', '0x3', '0x4', '0x5', '0x2a'].map((id) => (
              <Select.Item key={id} label={`Chain ${id}`} value={id} />
            ))}
          </Select>
          <Select
            minWidth="180"
            placeholder="Choose Address"
            defaultValue={providerApi.selectedAddress}
            onValueChange={(value) => {
              // TODO only notify to Dapp when isConnected?
              providerApi.selectedAddress = value;
              if (isExtension) {
                window.extJsBridgeUiToBg.requestSync({
                  data: {
                    method: 'internal_changeAccounts',
                    params: providerApi.selectedAddress,
                  },
                });
              } else if (providerApi.isConnected) {
                jsBridge?.requestSync({
                  data: {
                    method: 'metamask_accountsChanged',
                    params: [providerApi.selectedAddress],
                  },
                });
              }
            }}
          >
            {providerApi.accounts.map((address) => (
              <Select.Item
                key={address}
                label={`${address.slice(0, 6)}...${address.slice(-4)}`}
                value={address}
              />
            ))}
          </Select>
          <Button
            size="xs"
            onPress={() => {
              // electron webview reload()
              webviewRef.current.reload();
            }}
          >
            Reload
          </Button>
        </HStack>
        {fullDemo && (
          <VStack space={2}>
            <Button
              size="sm"
              onPress={() => setWebViewVisible(!webviewVisible)}
            >
              Toggle WebView Visible
            </Button>
            <Select
              minWidth="360"
              selectedValue={srcLocal}
              onValueChange={(v) => setSrcLocal(v)}
            >
              {srcList.map((uri) => (
                <Select.Item key={uri} label={uri} value={uri} />
              ))}
            </Select>

            <HStack space={2}>
              <Button
                onPress={() => {
                  providerApi.isConnected = false;
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
                  providerApi.isConnected = true;
                  jsBridge?.request({
                    data: {
                      method: 'metamask_accountsChanged',
                      params: [providerApi.selectedAddress],
                    },
                  });
                  jsBridge?.request({
                    data: {
                      method: 'metamask_chainChanged',
                      params: {
                        chainId: providerApi.chainId,
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
                  setResName((res as { onekeyNameRes: string })?.onekeyNameRes);
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
      <Box flex={1}>
        {/* TODO Universal WebView */}
        {webviewVisible && isDesktop && (
          <DesktopWebView
            src={srcLocal}
            ref={setWebViewRef}
            receiveHandler={providerApi.receiveHandler}
          />
        )}
        {webviewVisible && isApp && (
          <NativeWebView
            src={srcLocal}
            ref={setWebViewRef}
            receiveHandler={providerApi.receiveHandler}
          />
        )}
        {webviewVisible && (isWeb || isExtension) && (
          <iframe
            title="iframe-web"
            src={srcLocal}
            frameBorder="0"
            style={{ height: '100%', width: '100%' }}
          />
        )}
      </Box>
    </Box>
  );
}

export default DemoInpageProvider;
