const endpointsMap: Record<
  'fiat' | 'wss' | 'covalent',
  { prd: string; test: string }
> = {
  fiat: {
    prd: 'https://fiat.onekeycn.com',
    test: 'https://fiat.onekeytest.com',
  },
  wss: {
    prd: 'wss://fiat.onekeycn.com',
    test: 'wss://fiat.onekeytest.com',
  },
  covalent: {
    prd: 'https://node.onekey.so/covalent/client1-HghTg3a33',
    test: 'https://node.onekeytest.com/covalent/client1-HghTg3a33',
  },
};

let endpoint = '';
let websocketEndpoint = '';
let covalentApiEndpoint = '';

export const switchTestEndpoint = (isTestEnable?: boolean) => {
  const key = isTestEnable ? 'test' : 'prd';
  endpoint = endpointsMap.fiat[key];
  websocketEndpoint = endpointsMap.wss[key];
  covalentApiEndpoint = endpointsMap.covalent[key];
};

switchTestEndpoint(false);

export const getFiatEndpoint = () => endpoint;
export const getSocketEndpoint = () => websocketEndpoint;
export const getCovalentApiEndpoint = () => covalentApiEndpoint;
