// @ts-nocheck
// inject css to dapp site
// import './content-script.css';

import inpageContentScript from '@onekeyhq/inpage-provider/src/extension/inpageContentScript';
import {
  IInpageProviderRequestPayload,
  JsBridgeEventPayload,
} from '@onekeyhq/inpage-provider/src/types';
import { Alert } from 'react-native';
import { IJsBridge } from '../../../../@types/types';

console.log('[OneKey RN]: Content script works!112');
console.log('   Must reload extension for modifications to take effect.');

inpageContentScript.inject();
const jsBridgeHost: IJsBridge = inpageContentScript.createHost();
// @ts-ignore
window.contentJsBridge = jsBridgeHost;

const accounts = [
  '0x99f825d80cadd21d77d13b7e13d25960b40a6299',
  '0xc8f560c412b345aa6a5dce56d32d36d1af0b4f2a',
  '0xfb7def5f39f977c4d0e28a648ccb16d4f254aef0',
  '0x76b4a2de2e67ef5ee4a5050352aec077208fc7f1',
];
const chainId = '0x1'; // 0x3 Ropsten
let selectedAddress = accounts[0];
let isConnected = false;
function handleProviderMethods(
  jsBridge: IJsBridge,
  event: JsBridgeEventPayload,
  isApp: boolean,
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

jsBridgeHost.on('message', (event: JsBridgeEventPayload) => {
  if ((event?.data as { method: string })?.method) {
    handleProviderMethods(jsBridgeHost, event, false);
  }
});

window.changeAccounts = (index) => {
  // eslint-disable-next-line prefer-destructuring,@typescript-eslint/no-unsafe-member-access
  selectedAddress = accounts[index];
  // eslint-disable-next-line @typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-member-access
  window.contentJsBridge.request({
    method: 'metamask_accountsChanged',
    params: [selectedAddress],
  });
};

export {};
