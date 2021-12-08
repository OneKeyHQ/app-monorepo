// @ts-nocheck
import createJsBridgeBase from '@onekeyhq/inpage-provider/src/jsBridge/createJsBridgeBase';
import { JsBridgeEventPayload } from '@onekeyhq/inpage-provider/src/types';

// const abc: JsBridgeEventPayload | null = null;

it('two bridge communication', async () => {
  let currentChainId = '0x1';
  const host = createJsBridgeBase({
    sendPayload(str) {
      inpage.receive(str);
    },
  });
  host.on('message', (event: JsBridgeEventPayload) => {
    const { method } = event.data;
    if (method === 'eth_chainId') {
      host.response(event.id, currentChainId);
    }
  });

  const inpage = createJsBridgeBase({
    sendPayload(str) {
      host.receive(str);
    },
  });
  inpage.on('message', (event: JsBridgeEventPayload) => {
    const { method, params } = event.data;
    if (method === 'metamask_chainChanged') {
      currentChainId = params.chainId;
      // TODO should response here force resolve Promise call
      inpage.response(event.id, '');
    }
  });

  // ----------------------------------------------
  const chainId = await inpage.request({ method: 'eth_chainId' });
  expect(currentChainId).toEqual(chainId);

  await host.request({
    method: 'metamask_chainChanged',
    params: { chainId: '0x2' },
  });
  expect(currentChainId).toEqual('0x2');
});
