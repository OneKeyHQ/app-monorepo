// import { Token as ServerToken, top50 } from '@onekey/token-50-token-list';
import { uniqBy } from 'lodash';

import { SEPERATOR } from '@onekeyhq/shared/src/engine/engineConsts';

import { formatServerToken, isValidTokenId } from '../../../managers/token';

import { SimpleDbEntityBase } from './SimpleDbEntityBase';
import { SimpleDbEntityLocalTokens } from './SimpleDbEntityLocalTokens';

import type { ServerToken, Token } from '../../../types/token';

export type ISimpleDbEntityTokensData = {
  [key: string]: Token[];
};

export class SimpleDbEntityTokens extends SimpleDbEntityBase<ISimpleDbEntityTokensData> {
  entityName = 'tokens';

  localTokens = new SimpleDbEntityLocalTokens();

  override enableCache = true;

  async updateTokens(impl: string, chainId: string, tokens: ServerToken[]) {
    const networkId = `${impl}--${chainId}`;
    const normalizedTokens = tokens.map((t) => formatServerToken(t));
    await this.saveTokens(networkId, normalizedTokens);
  }

  async saveTokens(networkId: string, tokens: Token[]) {
    const savedTokens = await this.getRawData();
    const data = {
      ...(savedTokens || {}),
      [networkId]: tokens || [],
    };
    return this.setRawData(data);
  }

  async getTokens({
    networkId,
    accountId,
    query,
  }: {
    networkId: string;
    query?: Partial<Token>;
    accountId?: string;
  }) {
    if (accountId) {
      return this.getAccountTokens(networkId, accountId);
    }
    const tokensMap = await this.getRawData();
    if (typeof tokensMap !== 'object' || tokensMap === null) {
      return [];
    }
    const tokens = tokensMap[networkId] ?? [];
    const localAddedTokens = await this.localTokens.getUnknownAccountTokens(
      networkId,
    );
    for (const l of localAddedTokens) {
      let localTokenId = l.id;
      if (!isValidTokenId(l.id)) {
        localTokenId = l.isNative
          ? l.networkId
          : `${l.networkId}${SEPERATOR}${l.tokenIdOnNetwork}`;
      }
      if (!tokens.find((t) => t.id === localTokenId)) {
        tokens.push({
          ...l,
          id: localTokenId,
        });
      }
    }
    const queryList = Object.entries(query || {});
    if (!queryList.length) {
      return tokens;
    }
    return tokens.filter((t) => {
      for (const [k, v] of queryList) {
        if (k && t[k as keyof Token] !== v) {
          return false;
        }
      }
      return true;
    });
  }

  async getPresetToken(
    networkId: string,
    tokenIdOnNetwork: string,
  ): Promise<Token | undefined> {
    const tokens = await this.getTokens({
      networkId,
      query: { tokenIdOnNetwork },
    });
    return tokens?.[0];
  }

  async getAccountTokens(
    networkId: string,
    accountId: string,
  ): Promise<Token[]> {
    const tokens = await this.getTokens({
      networkId,
      query: { addToIndex: true },
    });
    const local = await this.localTokens.getData();
    const current = local[accountId] || {
      added: [],
      removed: [],
    };
    for (const l of current.added) {
      if (!tokens.find((t) => t.id === l.id)) {
        tokens.push(l);
      }
    }
    return tokens
      .filter((t) => !current.removed.includes(t.id))
      .filter((t) => t.networkId === networkId);
  }

  async addTokenToAccount(accountId: string, token: Token) {
    return this.localTokens.addToken(accountId, token);
  }

  async addToken(token: Token) {
    return this.localTokens.addTokenToUnknownAccount(token);
  }

  async insertTokens(networkId: string, tokens: Token[]) {
    const savedTokens = await this.getRawData();
    const data = {
      ...(savedTokens || {}),
      [networkId]: uniqBy(
        [...(savedTokens?.[networkId] || []), ...tokens],
        'address',
      ),
    };
    return this.setRawData(data);
  }

  async removeTokenFromAccount(accountId: string, tokenId: string) {
    return this.localTokens.removeToken(accountId, tokenId);
  }

  async clearTokens() {
    return this.setRawData({});
  }

  async clearLocalAddedTokens() {
    return this.localTokens.clear();
  }
}
