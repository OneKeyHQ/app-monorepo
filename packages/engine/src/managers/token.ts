import axios from 'axios';
import qs from 'qs';

import { ServerToken, Token } from '@onekeyhq/kit/src/store/typings';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';

import { SEPERATOR } from '../constants';
import { getFiatEndpoint } from '../endpoint';
import { OneKeyInternalError } from '../errors';

export type TokenQuery = {
  impl: string;
  chainId: number;
  query?: string;
};

export type TokenSource = {
  name: string;
  logo: string;
  count: number;
};

export type TokenDetailQuery = {
  impl: string;
  chainId: number;
  address: string;
};

let cachedTokenSourceList: TokenSource[] = [];

function getNetworkIdFromTokenId(tokenId: string): string {
  const [impl, chainId, tokenIdOnNetwork] = tokenId.split(SEPERATOR);
  if (impl && chainId && tokenIdOnNetwork) {
    return `${impl}${SEPERATOR}${chainId}`;
  }
  throw new OneKeyInternalError(`Invalid tokenId ${tokenId}.`);
}

async function fetchData<T>(
  path: string,
  query: Record<string, unknown> = {},
  fallback: T,
): Promise<T> {
  const endpoint = getFiatEndpoint();
  const apiUrl = `${endpoint}${path}?${qs.stringify(query)}`;
  try {
    const { data } = await axios.get<T>(apiUrl);
    return data;
  } catch (error) {
    debugLogger.common.error(`fetch ${apiUrl} error`, {
      query,
    });
    return fallback;
  }
}

export const checkTokenUpdate = async (timestamp: number): Promise<boolean> =>
  fetchData(
    '/token/check-update',
    {
      timestamp,
    },
    false,
  );

export const fetchTokenTop2000 = async (
  params: TokenQuery,
): Promise<ServerToken[]> => {
  const { chainId, impl, query } = params;
  const search = {
    chainId: String(chainId),
    impl,
  };
  if (query) {
    Object.assign(search, { query });
  }
  return fetchData('/token/list', search, []);
};

export const fetchTokenSource = async (): Promise<TokenSource[]> => {
  if (cachedTokenSourceList.length) {
    return cachedTokenSourceList;
  }
  const data = await fetchData('/token/source', {}, []);
  cachedTokenSourceList = data;
  return data;
};

export const fetchTokenDetail = async (
  params: TokenDetailQuery,
): Promise<Token | undefined> => {
  const { impl, chainId, address } = params;
  return fetchData(
    '/token/detail',
    {
      impl,
      chainId: String(chainId),
      address,
    },
    undefined,
  );
};

export { getNetworkIdFromTokenId };
