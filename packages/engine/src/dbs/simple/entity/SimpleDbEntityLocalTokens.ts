import { SimpleDbEntityBase } from './SimpleDbEntityBase';

import type { Token } from '../../../types/token';

export type ISimpleDbEntityLocalTokensData = {
  [accountId: string]: {
    added: Token[];
    // case tokens addToIndex is server maintened
    // should save removed from index token ids
    removed: string[];
  };
};

const unknownAccountName = 'unknown';

export class SimpleDbEntityLocalTokens extends SimpleDbEntityBase<ISimpleDbEntityLocalTokensData> {
  entityName = 'localTokens';

  override enableCache = true;

  async addToken(accountId: string, token: Token) {
    const data = await this.getRawData();
    const current = data?.[accountId] || {
      added: [],
      removed: [],
    };
    if (!token.addToIndex) {
      current.added = current.added.filter((t) => t.id !== token.id);
      current.added.push(token);
    }
    current.removed = current.removed.filter((id) => id !== token.id);
    await this.setRawData({
      ...data,
      [accountId]: current,
    });
    return token;
  }

  async addTokenToUnknownAccount(token: Token) {
    return this.addToken(unknownAccountName, token);
  }

  async getUnknownAccountTokens(networkId: string) {
    const data = await this.getData();
    const tokens = data?.[unknownAccountName]?.added || [];
    return tokens.filter((t) => t.networkId === networkId);
  }

  async removeToken(accountId: string, tokenId: string) {
    const data = await this.getRawData();
    const current = data?.[accountId] || {
      added: [],
      removed: [],
    };
    current.added = current.added.filter((t) => t.id !== tokenId);
    if (!current.removed.includes(tokenId)) {
      current.removed.push(tokenId);
    }
    await this.setRawData({
      ...data,
      [accountId]: current,
    });
  }

  async getRemovedTokens(accountId: string, networkId: string) {
    const localTokenData = await this.getData();
    const removedTokens: string[] = [];
    localTokenData[accountId]?.removed?.forEach((tokenIdWithNetwork) => {
      // "evm--1--0x4fabb145d64652a948d72533023f6e7a623c7c53"
      const [impl, chainId, tId] = tokenIdWithNetwork.split('--');
      if (`${impl}--${chainId}` === networkId) {
        removedTokens.push(tId);
      }
    });
    return removedTokens;
  }

  async getData() {
    return (await this.getRawData()) || {};
  }

  async clear() {
    return this.setRawData({});
  }
}
