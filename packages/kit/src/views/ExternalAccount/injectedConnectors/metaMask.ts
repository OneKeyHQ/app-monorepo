import { initializeConnector } from '@web3-react/core';
import { MetaMask } from '@web3-react/metamask';

import type { IInjectedConnectorInfoOptions } from './index';

function createConnector(): IInjectedConnectorInfoOptions {
  const [connector, hooks, store] = initializeConnector<MetaMask>(
    (actions) => new MetaMask({ actions }),
  );

  return { connector, hooks, store };
}
export default {
  createConnector,
};
