import axios from 'axios';
import qs from 'qs';

import store from '@onekeyhq/kit/src/store';
import { ServerToken, Token } from '@onekeyhq/kit/src/store/typings';

import { SEPERATOR } from '../constants';
import { OneKeyInternalError } from '../errors';

export type TokenQuery = {
  impl: string;
  chainId: number;
  query?: string;
};

export type TokenSource = {
  name: string;
  logo: string;
  count: string;
};

export type TokenDetailQuery = {
  impl: string;
  chainId: number;
  address: string;
};

export const getFiatEndpoint = () => {
  const { useTestFiatEndpoint } = store.getState()?.settings?.devMode;
  return useTestFiatEndpoint
    ? 'https://fiat.onekeytest.com'
    : 'https://fiat.onekeycn.com';
};

function getNetworkIdFromTokenId(tokenId: string): string {
  const [impl, chainId, tokenIdOnNetwork] = tokenId.split(SEPERATOR);
  if (impl && chainId && tokenIdOnNetwork) {
    return `${impl}${SEPERATOR}${chainId}`;
  }
  throw new OneKeyInternalError(`Invalid tokenId ${tokenId}.`);
}

export const checkTokenUpdate = async (timestamp: number): Promise<boolean> => {
  const endpoint = getFiatEndpoint();
  const apiUrl = `${endpoint}/token/check-update?timestamp=${timestamp}`;
  const { data } = await axios.get<boolean>(apiUrl);
  return data;
};

export const fetchTokenTop2000 = async (
  params: TokenQuery,
): Promise<ServerToken[]> => {
  const endpoint = getFiatEndpoint();
  const { chainId, impl, query } = params;
  const search = {
    chainId: String(chainId),
    impl,
  };
  if (query) {
    Object.assign(search, { query });
  }
  const apiUrl = `${endpoint}/token/list?${qs.stringify(search)}`;
  const { data } = await axios.get<ServerToken[]>(apiUrl);
  return data;
};

export const fetchTokenSource = async (): Promise<TokenSource[]> => {
  const endpoint = getFiatEndpoint();
  const apiUrl = `${endpoint}/token/source`;
  const { data } = await axios.get<TokenSource[]>(apiUrl);
  return data;
};

export const fetchTokenDetail = async (
  params: TokenDetailQuery,
): Promise<Token | undefined> => {
  const endpoint = getFiatEndpoint();
  const { impl, chainId, address } = params;
  const apiUrl = `${endpoint}/token/detail?${qs.stringify({
    impl,
    chainId: String(chainId),
    address,
  })}`;
  const { data } = await axios.get<Token>(apiUrl);
  return data;
};

export { getNetworkIdFromTokenId };
