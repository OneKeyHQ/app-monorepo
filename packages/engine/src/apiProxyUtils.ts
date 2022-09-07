import { RestfulRequest } from '@onekeyfe/blockchain-libs/dist/basic/request/restful';
import memoizee from 'memoizee';

import { getFiatEndpoint } from './endpoint';

// https://onekeyhq.atlassian.net/wiki/spaces/ONEKEY/pages/171442184
export const balanceSupprtedNetwork: Record<string, string> = {
  // alchemy
  'evm--42161': 'arbitrum',
  'evm--1': 'eth',
  'evm--10': 'optimism',
  'evm--137': 'polygon',
  'evm--421611': 'tarbitrum',
  'evm--69': 'toptimism',
  'evm--80001': 'tpolygon',

  // moralis
  // avalanche: 'avalanche',
  // eth: 'eth',
  // polygon: 'polygon',
  // cronos: 'cronos',
  // fantom: 'fantom',
  // bsc: 'bsc',
  // tbsc: 'bsc testnet',

  'evm--43114': 'avalanche',
  'evm--56': 'bsc',
  'evm--25': 'cronos',
  'evm--250': 'fantom',
  'evm--3': 'teth',
  'evm--97': 'tbsc',
} as const;

type ValueOf<T> = T[keyof T];
export type TokenBalancesQuery = {
  network: ValueOf<typeof balanceSupprtedNetwork>;
  address: string;
  // eslint-disable-next-line camelcase
  contract_addresses?: string[];
};

export type TokenBalancesResponse = {
  address: string;
  balance: string;
  name?: string;
}[];

const getBalances = async (
  networkId: string,
  address: string,
  tokenAddresses?: string[],
) => {
  if (!balanceSupprtedNetwork[networkId]) {
    return;
  }
  const req = new RestfulRequest(getFiatEndpoint());
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
