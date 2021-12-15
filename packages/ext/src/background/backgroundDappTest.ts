// @ts-nocheck
/* eslint-disable no-restricted-globals,@typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-unsafe-assignment,@typescript-eslint/no-unused-vars */

import providerApi from '@onekeyhq/inpage-provider/src/demo/providerApi';

function init(jsBridgeHost: unknown) {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  self.contentJsBridge = jsBridgeHost;

  // eslint-disable-next-line no-restricted-globals
  self.changeAccounts = (address) => {
    // eslint-disable-next-line prefer-destructuring,@typescript-eslint/no-unsafe-member-access
    providerApi.selectedAddress = address;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-member-access
    jsBridgeHost.requestToAllCS({
      method: 'metamask_accountsChanged',
      params: [providerApi.selectedAddress],
    });
  };

  self.changeChain = (localChainId) => {
    providerApi.chainId = localChainId;
    jsBridgeHost.requestToAllCS({
      method: 'metamask_chainChanged',
      params: { chainId: providerApi.chainId },
    });
  };
}

export default {
  init,
  receiveHandler: providerApi.receiveHandler,
};
