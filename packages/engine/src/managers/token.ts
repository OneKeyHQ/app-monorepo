import axios from 'axios';

import { ServerToken, Token } from '@onekeyhq/kit/src/store/typings';

import { SEPERATOR } from '../constants';
import simpleDb from '../dbs/simple/simpleDb';
import { OneKeyInternalError } from '../errors';

export interface TokenQuery {
  impl: string;
  chainId: number;
  query?: string;
}

export interface TokenSource {
  name: string;
  logo: string;
  count: string;
}

export interface TokenDetailQuery {
  impl: string;
  chainId: number;
  address: string;
}

const getEndpoint = () => simpleDb.debugConfig.getData('fiatEndpoint');

function getNetworkIdFromTokenId(tokenId: string): string {
  const [impl, chainId, tokenIdOnNetwork] = tokenId.split(SEPERATOR);
  if (impl && chainId && tokenIdOnNetwork) {
    return `${impl}${SEPERATOR}${chainId}`;
  }
  throw new OneKeyInternalError(`Invalid tokenId ${tokenId}.`);
}

export const checkTokenUpdate = async (timestamp: number): Promise<boolean> => {
  const endpoint = await getEndpoint();
  const apiUrl = `${endpoint}/token/check-update?timestamp=${timestamp}`;
  const { data } = await axios.get<boolean>(apiUrl);
  return data;
};

export const fetchTokenTop2000 = async (
  params: TokenQuery,
): Promise<ServerToken[]> => {
  const endpoint = await getEndpoint();
  const { chainId, impl, query } = params;
  const search = {
    chainId: String(chainId),
    impl,
  };
  if (query) {
    Object.assign(search, { query });
  }
  const apiUrl = `${endpoint}/token/list?${new URLSearchParams(
    search,
  ).toString()}`;
  const { data } = await axios.get<ServerToken[]>(apiUrl);
  return data;
};

export const fetchTokenSource = async (): Promise<TokenSource[]> => {
  const endpoint = await getEndpoint();
  const apiUrl = `${endpoint}/token/source`;
  const { data } = await axios.get<TokenSource[]>(apiUrl);
  return data;
};

export const fetchTokenDetail = async (
  params: TokenDetailQuery,
): Promise<Token | undefined> => {
  const endpoint = await getEndpoint();
  const { impl, chainId, address } = params;
  const apiUrl = `${endpoint}/token/detail?${new URLSearchParams({
    impl,
    chainId: String(chainId),
    address,
  }).toString()}`;
  const { data } = await axios.get<Token>(apiUrl);
  return data;
};

export { getNetworkIdFromTokenId };
