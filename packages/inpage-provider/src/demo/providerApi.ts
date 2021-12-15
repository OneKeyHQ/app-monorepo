/* eslint-disable @typescript-eslint/no-unsafe-call,no-restricted-globals */
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { Alert } from 'react-native';
import {
  IInpageProviderRequestData,
  IJsBridgeMessagePayload,
  IJsBridgeReceiveHandler,
} from '../types';

const { isExtension, isNative } = platformEnv;
const isApp = isNative;

class ProviderApi {
  accounts = [
    '0x99f825d80cadd21d77d13b7e13d25960b40a6299',
    '0xc8f560c412b345aa6a5dce56d32d36d1af0b4f2a',
    '0xfb7def5f39f977c4d0e28a648ccb16d4f254aef0',
    '0x76b4a2de2e67ef5ee4a5050352aec077208fc7f1',
  ];

  chainId = '0x1'; // 0x3 Ropsten

  selectedAddress = this.accounts[0];

  isConnected = false;

  receiveHandler: IJsBridgeReceiveHandler = async (
    event: IJsBridgeMessagePayload,
  ) => {
    const { origin } = event;
    const { method, params } = event?.data as IInpageProviderRequestData;
    console.log('receiveHandler', { method, params });

    // call background global methods (backgroundDappTest.ts)
    if (platformEnv.isExtension) {
      // UI: extJsBridgeUiToBg.request({method:'internal_changeAccounts',params:'0x...'})
      if (method === 'internal_changeAccounts') {
        // notify to all dapps
        // @ts-ignore
        self.changeAccounts(params);
        return;
      }
      // UI: extJsBridgeUiToBg.request({method:'internal_changeChain',params:'0x3'})
      if (method === 'internal_changeChain') {
        // notify to all dapps
        // @ts-ignore
        self.changeChain(params);
        return;
      }
    }

    // metamask_getProviderState
    if (method === 'eth_requestAccounts') {
      console.log('=============== confirm check');
      if (!this.isConnected) {
        const title = `Confirm connect site: ${origin as string}`;
        if (isApp) {
          await new Promise((resolve) => {
            Alert.alert('Confirm', title, [
              {
                text: 'NO',
                onPress: () => {
                  console.log('Cancel Pressed');
                  this.isConnected = false;
                  resolve(true);
                },
                style: 'cancel',
              },
              {
                text: 'YES',
                onPress: () => {
                  console.log('OK Pressed');
                  this.isConnected = true;
                  resolve(false);
                },
              },
            ]);
          });
        } else if (isExtension) {
          this.isConnected = true;
        } else if (window.confirm(title)) {
          this.isConnected = true;
        }
      }
    }
    if (method === 'eth_accounts' || method === 'eth_requestAccounts') {
      return {
        // baseChain: 'ETH',
        // streamName: 'onekey-provider-eth',
        id: undefined,
        jsonrpc: '2.0',
        result: this.isConnected ? [this.selectedAddress] : [],
      };
    }
    if (method === 'eth_chainId') {
      return {
        id: undefined,
        jsonrpc: '2.0',
        result: this.chainId,
      };
    }
    if (method === 'eth_blockNumber') {
      return {
        id: undefined,
        jsonrpc: '2.0',
        result: '0xd29f1a',
      };
    }
    if (method === 'eth_sendTransaction') {
      if (platformEnv.isExtension) {
        return new Promise(() => {
          chrome.windows.create({
            focused: true,
            type: 'popup',
            // init size same to ext ui-popup.html
            height: 600 + 50, // height including title bar, so should add 50 more
            width: 375,
            url: '/ui-popup.html?router=Approval#approval-window',
          });
        });
      }
    }

    throw new Error(`dapp provider method not support (method=${method})`);
  };
}

const providerApi = new ProviderApi();

export default providerApi;
