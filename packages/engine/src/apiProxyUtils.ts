import memoizee from 'memoizee';

import { OnekeyNetwork } from '@onekeyhq/shared/src/config/networkIds';
import { RestfulRequest } from '@onekeyhq/shared/src/request/RestfulRequest';

import { getFiatEndpoint } from './endpoint';

// https://onekeyhq.atlassian.net/wiki/spaces/ONEKEY/pages/171442184
export const balanceSupprtedNetwork: string[] = [
  // alchemy
  OnekeyNetwork.arbitrum,
  OnekeyNetwork.eth,
  OnekeyNetwork.optimism,
  OnekeyNetwork.polygon,
  OnekeyNetwork.tarbitrum,
  OnekeyNetwork.toptimism,
  OnekeyNetwork.tpolygon,

  // moralis
  OnekeyNetwork.avalanche,
  OnekeyNetwork.bsc,
  OnekeyNetwork.cronos,
  OnekeyNetwork.fantom,
  OnekeyNetwork.goerli,
  OnekeyNetwork.tbsc,

  // moralis, non-evm
  OnekeyNetwork.sol,
  OnekeyNetwork.tsol,

  OnekeyNetwork.near,
  OnekeyNetwork.stc,
  OnekeyNetwork.apt,
  OnekeyNetwork.ada,
];

export type TokenBalancesQuery = {
  network: string;
  address: string;
  // eslint-disable-next-line camelcase
  contract_addresses?: string[];
};

export type TokenBalancesResponse = {
  address: string;
  balance: string;
  name?: string;
  // for sol
  sendAddress: string;
}[];

const getBalances = async (
  networkId: string,
  address: string,
  tokenAddresses?: string[],
) => {
  if (!balanceSupprtedNetwork.includes(networkId)) {
    return;
  }
  const req = new RestfulRequest(getFiatEndpoint(), {}, 60 * 1000);
  const query: TokenBalancesQuery = {
    network: networkId,
    address,
  };
  if (tokenAddresses?.length) {
    query.contract_addresses = tokenAddresses;
  }
  return (await req
    .get('/token/balances', query)
    .then((res) => res.json())) as TokenBalancesResponse;
};
export const getBalancesFromApi = memoizee(getBalances, {
  maxAge: 5000,
  normalizer: (...args) => JSON.stringify(args),
});
