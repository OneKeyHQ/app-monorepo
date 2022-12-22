// @ts-nocheck
import { JsBridgeSimple } from '@onekeyfe/cross-inpage-provider-core';

import type { IJsBridgeMessagePayload } from '@onekeyfe/cross-inpage-provider-types';

describe('CrossInpageProvider Tests', () => {
  it('two bridge communication', async () => {
    let currentChainId = '0x3';
    // TODO sendAsString=false
    const host = new JsBridgeSimple({
      timeout: 0, // TODO remove, fix in JsBridgeSimple: this.callbacksExpireTimeout=0
      sendAsString: false,
      receiveHandler(event: IJsBridgeMessagePayload) {
        // throw new Error('hhhhhh');
        const { method } = event.data;
        if (method === 'eth_chainId') {
          return currentChainId;
          // return '0x22';
        }
      },
    });
    const inpage = new JsBridgeSimple({
      timeout: 0, // TODO remove, fix in JsBridgeSimple: this.callbacksExpireTimeout=0
      sendAsString: false,
      receiveHandler(event: IJsBridgeMessagePayload) {
        const { method, params } = event.data;
        if (method === 'metamask_chainChanged') {
          currentChainId = params.chainId;
          // TODO should response here force resolve Promise call
          // inpage.response(event.id, '');
        }
      },
    });

    host.setRemote(inpage);
    inpage.setRemote(host);

    // TODO async event handler?
    host.on('error', (error) => {
      console.log(error);
    });

    // ----------------------------------------------
    const chainId = await inpage.request({
      scope: 'ethereum',
      data: { method: 'eth_chainId' },
    });
    expect(chainId).toEqual(currentChainId);

    host.requestSync({
      scope: 'ethereum',
      data: {
        method: 'metamask_chainChanged',
        params: { chainId: '0x2' },
      },
    });
    expect(currentChainId).toEqual('0x2');
  });
});
