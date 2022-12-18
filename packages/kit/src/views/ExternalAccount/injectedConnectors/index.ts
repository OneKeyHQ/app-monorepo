import { WALLET_CONNECT_WALLET_NAMES } from '../../../components/WalletConnect/walletConnectConsts';

import metaMask from './metaMask';

import type { Web3ReactHooks } from '@web3-react/core';
import type { Connector, Web3ReactStore } from '@web3-react/types';

export type IInjectedConnectorInfoOptions = {
  connector: Connector;
  hooks: Web3ReactHooks;
  store: Web3ReactStore;
};
export class InjectedConnectorInfo {
  constructor({ connector, hooks, store }: IInjectedConnectorInfoOptions) {
    this.connector = connector;
    this.hooks = hooks;
    this.store = store;
  }

  connector!: Connector;

  hooks!: Web3ReactHooks;

  store!: Web3ReactStore;

  get isActivating(): boolean {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { activating, chainId, accounts } = this.store.getState();
    return Boolean(activating);
  }

  get isActive(): boolean {
    const { chainId, activating, accounts } = this.store.getState();
    return Boolean(chainId && accounts && !activating);
  }

  get isConnected(): boolean {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { chainId, accounts, activating } = this.store.getState();
    return Boolean(chainId && accounts && accounts.length);
  }

  get connectedAccount(): string | undefined {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { chainId, accounts, activating } = this.store.getState();
    return accounts?.[0];
  }
}

const cacheMap: {
  [walletName: string]: InjectedConnectorInfo;
} = {};

function createInjectedConnectorByName({
  name,
}: {
  name: string;
}): InjectedConnectorInfo {
  if (name === WALLET_CONNECT_WALLET_NAMES.MetaMask) {
    return new InjectedConnectorInfo(metaMask.createConnector());
  }
  throw new Error(
    `createInjectedConnectorByName ERROR: wallet name not supported. name=${name}`,
  );
}

export function getInjectedConnector({
  name,
}: {
  name: string;
}): InjectedConnectorInfo {
  if (!cacheMap[name]) {
    cacheMap[name] = createInjectedConnectorByName({ name });
  }
  return cacheMap[name];
}
