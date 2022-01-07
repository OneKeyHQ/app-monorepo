import { BaseClient } from '@onekeyhq/blockchain-libs/dist/provider/abc';
import { Geth } from '@onekeyhq/blockchain-libs/dist/provider/chains/eth/geth';

import { IMPL_EVM } from './constants';
import { NotImplemented } from './errors';
import { DBNetwork } from './types/network';

const clientClasses: Record<string, new (url: string) => BaseClient> = {};
clientClasses[IMPL_EVM] = Geth;

function initClientFromDBNetwork(dbNetwork: DBNetwork): BaseClient {
  const Clazz = clientClasses[dbNetwork.impl];
  if (typeof Clazz !== 'undefined') {
    return new Clazz(dbNetwork.rpcURL); // TODO: other parameters.
  }
  throw new NotImplemented();
}

export { initClientFromDBNetwork };
