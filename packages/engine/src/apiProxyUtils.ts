import { RestfulRequest } from '@onekeyfe/blockchain-libs/dist/basic/request/restful';

import { getFiatEndpoint } from './endpoint';

export const balanceSupprtedNetwork: Record<string, string> = {
  // alchemy
  // arbitrum: 'arb',
  // eth: 'eth',
  // optimism: 'opt',
  // polygon: 'polygon',
  // 'evm--42161': 'arbitrum',
  // 'evm--1': 'eth',
  // 'evm--10': 'optimism',
  // 'evm--137': 'polygon',
  // moralis
  // avalanche: 'avalanche',
  // eth: 'eth',
  // polygon: 'polygon',
  // cronos: 'cronos',
  // fantom: 'fantom',
  // bsc: 'bsc',
  // tbsc: 'bsc testnet',
  // 'evm--43114': 'avalanche',
  // 'evm--25': 'cronos',
  // 'evm--250': 'fantom',
  // 'evm--56': 'bsc',
  // 'evm--97': 'tbsc',
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

export async function getBalancesFromApi(
  networkId: string,
  address: string,
  tokenAddresses?: string[],
) {
  if (!balanceSupprtedNetwork[networkId]) {
    return;
  }
  const req = new RestfulRequest(getFiatEndpoint());
  const query: TokenBalancesQuery = {
    network: balanceSupprtedNetwork[networkId],
    address,
  };
  if (tokenAddresses?.length) {
    query.contract_addresses = tokenAddresses;
  }
  return (await req
    .get('/token/balances', query)
    .then((res) => res.json())) as TokenBalancesResponse;
}
