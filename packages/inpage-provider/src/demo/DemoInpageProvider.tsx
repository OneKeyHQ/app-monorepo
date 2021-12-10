// @ts-nocheck
/* eslint-disable @typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-unused-vars */
import React, { useEffect, useState } from 'react';
import { Box, VStack, HStack, Button, Select } from '@onekeyhq/components';
import { Alert } from 'react-native';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import DesktopWebView from '../webview/DesktopWebView';
import {
  IInpageProviderRequestPayload,
  IJsBridge,
  JsBridgeEventPayload,
} from '../types';
import useWebViewBridge from '../webview/useWebViewBridge';
import NativeWebView from '../webview/NativeWebView';

const { isDesktop, isWeb, isExtension, isNative } = platformEnv;
const isApp = isNative;

const accounts = [
  '0x99f825d80cadd21d77d13b7e13d25960b40a6299',
  '0xc8f560c412b345aa6a5dce56d32d36d1af0b4f2a',
  '0xfb7def5f39f977c4d0e28a648ccb16d4f254aef0',
  '0x76b4a2de2e67ef5ee4a5050352aec077208fc7f1',
];
let chainId = '0x1'; // 0x3 Ropsten
let selectedAddress = accounts[0];
let isConnected = false;

function handleProviderMethods(
  jsBridge: IJsBridge,
  event: JsBridgeEventPayload,
) {
  const { id, origin } = event;
  const { method, params } = event?.data as IInpageProviderRequestPayload;
  console.log('handleProviderMethods', { method, params });
  let responseLater = false;
  const responseMessage = () => {
    if (method === 'eth_accounts' || method === 'eth_requestAccounts') {
      const res = {
        // baseChain: 'ETH',
        // streamName: 'onekey-provider-eth',
        id: undefined,
        jsonrpc: '2.0',
        result: isConnected ? [selectedAddress] : [],
      };
      jsBridge.response(id, res);
    }
    if (method === 'eth_chainId') {
      jsBridge.response(id, {
        id: undefined,
        jsonrpc: '2.0',
        result: chainId,
      });
    }
  };
  // metamask_getProviderState
  if (method === 'eth_requestAccounts') {
    console.log('=============== confirm check');
    if (!isConnected) {
      const title = `Confirm connect site: ${origin as string}`;
      if (isApp) {
        responseLater = true;
        Alert.alert('Confirm', title, [
          {
            text: 'NO',
            onPress: () => {
              console.log('Cancel Pressed');
              isConnected = false;
              responseMessage();
            },
            style: 'cancel',
          },
          {
            text: 'YES',
            onPress: () => {
              console.log('OK Pressed');
              isConnected = true;
              responseMessage();
            },
          },
        ]);
      } else if (window.confirm(title)) {
        isConnected = true;
      }
    }
  }

  if (!responseLater) {
    responseMessage();
  }
}

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
  const { jsBridge, setWebViewRef } = useWebViewBridge();
  const [webviewVisible, setWebViewVisible] = useState(true);
  useEffect(() => {
    if (!jsBridge) {
      return;
    }
    // window.webviewJsBridge = jsBridge;
    jsBridge.on('message', (event: JsBridgeEventPayload) => {
      console.log('jsBridge onMessage', event);
      if ((event?.data as { method: string })?.method) {
        handleProviderMethods(jsBridge, event, isApp);
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
            defaultValue={chainId}
            onValueChange={(value) => {
              setName(`${Date.now()}`);
              chainId = value;
              if (isExtension) {
                window.extJsBridgeUiToBg.request({
                  method: 'internal_changeChain',
                  params: chainId,
                });
              } else {
                // TODO only notify to Dapp when isConnected?
                // method === 'metamask_chainChanged' && this.selectedAddress
                // notifyAllConnections
                jsBridge?.request({
                  // metamask_accountsChanged
                  // metamask_unlockStateChanged
                  method: 'metamask_chainChanged',
                  params: {
                    chainId,
                    networkVersion: '1',
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
            defaultValue={selectedAddress}
            onValueChange={(value) => {
              // TODO only notify to Dapp when isConnected?
              selectedAddress = value;
              if (isExtension) {
                window.extJsBridgeUiToBg.request({
                  method: 'internal_changeAccounts',
                  params: selectedAddress,
                });
              } else if (isConnected) {
                jsBridge?.request({
                  method: 'metamask_accountsChanged',
                  params: [selectedAddress],
                });
              }
            }}
          >
            {accounts.map((address) => (
              <Select.Item
                key={address}
                label={`${address.slice(0, 6)}...${address.slice(-4)}`}
                value={address}
              />
            ))}
          </Select>
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
                  isConnected = false;
                  jsBridge?.request({
                    method: 'metamask_accountsChanged',
                    params: [],
                  });
                }}
              >
                disconnect 888
              </Button>
              <Button
                onPress={() => {
                  isConnected = true;
                  jsBridge?.request({
                    method: 'metamask_accountsChanged',
                    params: [selectedAddress],
                  });
                  jsBridge?.request({
                    method: 'metamask_chainChanged',
                    params: {
                      chainId,
                      networkVersion: '1',
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
                    onekeyName: newName,
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
          <DesktopWebView src={srcLocal} ref={setWebViewRef} />
        )}
        {webviewVisible && isApp && (
          <NativeWebView uri={srcLocal} ref={setWebViewRef} />
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
