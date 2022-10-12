import axios, { AxiosInstance } from 'axios';

import type { ChainInfo } from './types';

class BlockBook {
  readonly request: AxiosInstance;

  constructor(url: string) {
    this.request = axios.create({
      baseURL: url,
      timeout: 10000,
    });
  }

  getAccount(xpub: string, params: Record<string, any>): Promise<any> {
    return this.request.get(`/api/v2/xpub/${xpub}`, params).then((i) => {
      console.log(i);
      return i;
    });
  }
}

const getBlockBook = (chainInfo: ChainInfo) =>
  Promise.resolve(new BlockBook(chainInfo.clients[0].name));

export { BlockBook, getBlockBook };
