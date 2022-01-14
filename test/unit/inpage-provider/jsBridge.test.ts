// @ts-nocheck
import mockAsyncStorage from '@react-native-async-storage/async-storage/jest/async-storage-mock';

import JsBridgeSimple from '@onekeyhq/inpage-provider/src/jsBridge/JsBridgeSimple';
import { IJsBridgeMessagePayload } from '@onekeyhq/inpage-provider/src/types.d';

jest.mock('@react-native-async-storage/async-storage', () => mockAsyncStorage);

it('two bridge communication', async () => {
  let currentChainId = '0x3';
  // TODO sendAsString=false
  const host = new JsBridgeSimple({
    sendAsString: false,
    receiveHandler(event: IJsBridgeMessagePayload) {
      console.log('jest: host onMessage', event);
      // throw new Error('hhhhhh');
      const { method } = event.data;
      if (method === 'eth_chainId') {
        return currentChainId;
        // return '0x22';
      }
    },
  });
  const inpage = new JsBridgeSimple({
    sendAsString: false,
    receiveHandler(event: IJsBridgeMessagePayload) {
      console.log('jest: inpage onMessage', event);
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
    debugger;
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
