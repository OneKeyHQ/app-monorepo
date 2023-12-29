const endpointsMap: Record<
  'fiat' | 'wss' | 'covalent' | 'mempool' | 'getblock' | 'algosigner',
  { prd: string; test: string }
> = {
  fiat: {
    prd: 'https://api.onekeycn.com/api',
    // test: 'https://api-sandbox.onekeytest.com/api',
    // test: 'http://127.0.0.1:7001',
    test: 'http://10.44.22.148:7001',
  },
  wss: {
    prd: 'wss://api.onekeycn.com',
    test: 'wss://api-sandbox.onekeytest.com',
  },
  covalent: {
    prd: 'https://node.onekey.so/covalent/client1-HghTg3a33',
    test: 'https://node.onekeytest.com/covalent/client1-HghTg3a33',
  },
  mempool: {
    prd: 'https://node.onekey.so/mempool',
    test: 'https://node.onekeytest.com/mempool',
  },
  getblock: {
    prd: 'https://node.onekey.so/getblock-{chain}-{network}',
    test: 'https://node.onekeytest.com/getblock-{chain}-{network}',
  },
  algosigner: {
    prd: 'https://node.onekey.so/algosigner/{network}/indexer',
    test: 'https://node.onekeytest.com/algosigner/{network}/indexer',
  },
};

let endpointType: 'prd' | 'test' = 'prd';
export const switchTestEndpoint = (isTestEnable?: boolean) => {
  endpointType = isTestEnable ? 'test' : 'prd';
};

switchTestEndpoint(true);

export const getFiatEndpoint = () => endpointsMap.fiat[endpointType];
export const getSocketEndpoint = () => endpointsMap.wss[endpointType];
export const getCovalentApiEndpoint = () => endpointsMap.covalent[endpointType];

export function getMempoolEndpoint({
  network,
}: {
  network: 'mainnet' | 'testnet';
}) {
  const networkPath = network === 'mainnet' ? '' : network;
  return [endpointsMap.mempool[endpointType], networkPath]
    .filter(Boolean)
    .join('/');
}

export function getGetblockEndpoint({
  chain,
  network,
}: {
  chain: 'btc';
  network: 'mainnet' | 'testnet';
}) {
  return endpointsMap.getblock[endpointType]
    .replace('{chain}', chain)
    .replace('{network}', network);
}

export function getAlgoSignerEndpoint({
  network,
}: {
  network: 'mainnet' | 'testnet';
}) {
  return endpointsMap.algosigner[endpointType].replace('{network}', network);
}
