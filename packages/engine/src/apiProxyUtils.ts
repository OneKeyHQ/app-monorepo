import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';
import { RestfulRequest } from '@onekeyhq/shared/src/request/RestfulRequest';

import { getFiatEndpoint } from './endpoint';

export type TokenBalancesQuery = {
  network: string;
  address: string;
  // eslint-disable-next-line camelcase
  contract_addresses?: string[];
  xpub?: string;
};

export type TokenBalancesResponse = {
  address: string;
  balance: string;
  name?: string;
  // for sol
  sendAddress: string;
  bestBlockNumber?: string;
}[];

export const getBalancesFromApi = async ({
  networkId,
  address,
  tokenAddresses,
  xpub,
}: {
  networkId: string;
  address: string;
  tokenAddresses?: string[];
  xpub?: string;
}) => {
  const req = new RestfulRequest(getFiatEndpoint(), {}, 60 * 1000);
  const query: TokenBalancesQuery = {
    network: networkId,
    address,
  };
  if (xpub) {
    Object.assign(query, { xpub });
  }
  if (tokenAddresses?.length) {
    query.contract_addresses = tokenAddresses;
  }
  debugLogger.http.info('getBalancesFromApi', query);
  return (await req
    .get('/token/balances', query)
    .then((res) => res.json())) as TokenBalancesResponse;
};
