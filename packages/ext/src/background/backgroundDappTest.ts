// @ts-nocheck
/* eslint-disable no-restricted-globals,@typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-unsafe-assignment,@typescript-eslint/no-unused-vars */
import {
  IInpageProviderRequestPayload,
  JsBridgeEventPayload,
} from '@onekeyhq/inpage-provider/src/types';
import { IJsBridge } from '../../../../@types/types';

function init(jsBridgeHost: IJsBridge) {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  self.contentJsBridge = jsBridgeHost;

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
    const { id, origin, remoteId } = event;
    const { method, params, scope } =
      event?.data as IInpageProviderRequestPayload;
    // TODO scope=ethereum, solana, conflux, sollet, walletPrivate
    console.log('handleProviderMethods', { method, params });
    const responseLater = false;
    const responseMessage = () => {
      // UI: extJsBridgeUiToBg.request({method:'internal_changeAccounts',params:'0x...'})
      if (method === 'internal_changeAccounts') {
        self.changeAccounts(params);
      }
      // UI: extJsBridgeUiToBg.request({method:'internal_changeChain',params:'0x3'})
      if (method === 'internal_changeChain') {
        self.changeChain(params);
      }
      if (method === 'eth_accounts' || method === 'eth_requestAccounts') {
        const res = {
          // baseChain: 'ETH',
          // streamName: 'onekey-provider-eth',
          id: undefined,
          jsonrpc: '2.0',
          result: isConnected ? [selectedAddress] : [],
        };
        jsBridge.response(id, res, null, remoteId);
      }
      if (method === 'eth_chainId') {
        jsBridge.response(
          id,
          {
            id: undefined,
            jsonrpc: '2.0',
            result: chainId,
          },
          null,
          remoteId,
        );
      }
    };
    // metamask_getProviderState
    if (method === 'eth_requestAccounts') {
      console.log('=============== confirm check');
      if (!isConnected) {
        // TODO invoke ui comfirm
        // const title = `Confirm connect site: ${origin as string}`;
        // if (window.confirm(title)) {
        //   isConnected = true;
        // }
        isConnected = true;
      }
    }

    if (!responseLater) {
      responseMessage();
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-unsafe-call
  jsBridgeHost.on('message', (event: JsBridgeEventPayload) => {
    if ((event?.data as { method: string })?.method) {
      handleProviderMethods(jsBridgeHost, event, false);
    }
  });

  // eslint-disable-next-line no-restricted-globals
  self.changeAccounts = (address) => {
    // eslint-disable-next-line prefer-destructuring,@typescript-eslint/no-unsafe-member-access
    selectedAddress = address;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-member-access
    self.contentJsBridge.requestToAllCS({
      method: 'metamask_accountsChanged',
      params: [selectedAddress],
    });
  };
  self.changeChain = (localChainId) => {
    chainId = localChainId;
    self.contentJsBridge.requestToAllCS({
      method: 'metamask_chainChanged',
      params: { chainId },
    });
  };
}

export default {
  init,
};
