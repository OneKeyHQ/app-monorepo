import { Web3ReactHooks } from '@web3-react/core';
import { Connector, Web3ReactStore } from '@web3-react/types';

import { WALLET_CONNECT_WALLET_NAMES } from '../../../components/WalletConnect/walletConnectConsts';

import metaMask from './metaMask';

// TODO computeIsActive, computeIsConnected
// function computeIsActive({ chainId, accounts, activating }) {
//   return Boolean(chainId && accounts && !activating);
// }
export type IInjectedConnectorInfo = {
  connector: Connector;
  hooks: Web3ReactHooks;
  store: Web3ReactStore;
};
const cacheMap: {
  [walletName: string]: IInjectedConnectorInfo;
} = {};

function createInjectedConnectorByName({ name }: { name: string }) {
  if (name === WALLET_CONNECT_WALLET_NAMES.MetaMask) {
    return metaMask.createConnector();
  }
  throw new Error(
    `createInjectedConnectorByName ERROR: wallet name not supported. name=${name}`,
  );
}

export function getInjectedConnector({
  name,
}: {
  name: string;
}): IInjectedConnectorInfo {
  if (!cacheMap[name]) {
    cacheMap[name] = createInjectedConnectorByName({ name });
  }
  return cacheMap[name];
}
