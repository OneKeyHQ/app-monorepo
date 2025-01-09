import stringify from 'fast-json-stable-stringify';

import { RpcCacheMethodMap } from './constants';

interface ICacheKey {
  address: string;
  networkId: string;
  data: { method: string; params: any };
}

interface ICacheItem {
  timestamp: number;
  value: any;
}

export class RpcCache {
  private cache: Map<string, ICacheItem>;

  private readonly maxAge: number;

  private readonly impl: string;

  private _randomKeys: Record<string, number>;

  constructor({ maxAge, impl }: { maxAge: number; impl: string }) {
    this.cache = new Map();
    this.maxAge = maxAge;
    this.impl = impl;
    this._randomKeys = {};
  }

  private generateRandomKey(): number {
    // generate 6-digit number (100000-999999)
    return Math.floor(Math.random() * 900_000) + 100_000;
  }

  private getRandomKey(networkId: string): number {
    if (!this._randomKeys[networkId]) {
      this._randomKeys[networkId] = this.generateRandomKey();
    }
    return this._randomKeys[networkId];
  }

  private generateKey({ address, networkId, data }: ICacheKey): string {
    return `${address ?? ''}--${networkId ?? ''}--${this.getRandomKey(
      networkId,
    )}--${data.method}--${stringify(data.params)}`;
  }

  get(params: ICacheKey): any | undefined {
    const cacheKey = this.generateKey(params);
    const item = this.cache.get(cacheKey);

    if (item && Date.now() - item.timestamp > this.maxAge) {
      this.clear();
      return undefined;
    }

    return item?.value;
  }

  set({ address, networkId, data, value }: ICacheKey & { value: any }): void {
    if (!this.isCacheableMethod(data)) {
      return;
    }
    const cacheKey = this.generateKey({ address, networkId, data });
    this.cache.set(cacheKey, {
      timestamp: Date.now(),
      value,
    });
  }

  clear(): void {
    this._randomKeys = {};
    this.cache.clear();
  }

  isCacheableMethod(data: { method: string; params: any }): boolean {
    const cacheableMethods = RpcCacheMethodMap[this.impl];
    return cacheableMethods.includes(data.method);
  }
}
