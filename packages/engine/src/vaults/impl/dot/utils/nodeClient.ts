import { ApiPromise, HttpProvider, WsProvider } from '@polkadot/api';
import memoizee from 'memoizee';

const getNodeClient = async (rpcUrl: string) => {
  const uri = new URL(rpcUrl);
  let provider;
  if (uri.protocol === 'wss:') {
    provider = new WsProvider(rpcUrl);
  } else {
    provider = new HttpProvider(rpcUrl);
  }
  return ApiPromise.create({ provider });
};

const getClientCache = memoizee(
  async (rpcUrl: string) => getNodeClient(rpcUrl),
  {
    promise: true,
    primitive: true,
    maxAge: 1000 * 60 * 15,
    max: 1,
    normalizer: (args) => args[0],
    dispose: (client) => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        client.disconnect();
      } catch (e) {
        // ignore
      }
    },
  },
);

export { getClientCache, getNodeClient };
