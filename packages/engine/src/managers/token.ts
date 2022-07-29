import axios from 'axios';

import { ServerToken, Token } from '@onekeyhq/kit/src/store/typings';

import { SEPERATOR } from '../constants';
import { OneKeyInternalError } from '../errors';

const HostURL = 'https://fiat.onekeycn.com';

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

function getNetworkIdFromTokenId(tokenId: string): string {
  const [impl, chainId, tokenIdOnNetwork] = tokenId.split(SEPERATOR);
  if (impl && chainId && tokenIdOnNetwork) {
    return `${impl}${SEPERATOR}${chainId}`;
  }
  throw new OneKeyInternalError(`Invalid tokenId ${tokenId}.`);
}

export const checkTokenUpdate = async (timestamp: number): Promise<boolean> => {
  const apiUrl = `${HostURL}/token/check-update?timestamp=${timestamp}`;
  const { data } = await axios.get<boolean>(apiUrl);
  return data;
};

export const fetchTokenTop2000 = async (
  params: TokenQuery,
): Promise<ServerToken[]> => {
  const apiUrl = `${HostURL}/token/list?${new URLSearchParams(
    // @ts-ignore
    params,
  ).toString()}`;
  const { data } = await axios.get<ServerToken[]>(apiUrl);
  return data;
};

export const fetchTokenSource = async (): Promise<TokenSource[]> => {
  const apiUrl = `${HostURL}/token/source`;
  const { data } = await axios.get<TokenSource[]>(apiUrl);
  return data;
};

export const fetchTokenDetail = async (
  params: TokenDetailQuery,
): Promise<Token | undefined> => {
  const apiUrl = `${HostURL}/token/detail?${new URLSearchParams(
    // @ts-ignore
    params,
  ).toString()}`;
  const { data } = await axios.get<Token>(apiUrl);
  return data;
};

export { getNetworkIdFromTokenId };
