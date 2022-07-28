import { Token as ServerToken, top50 } from '@qwang/token-50-token-list';

import { IMPL_SOL, getSupportedImpls } from '../../../constants';
import { getImplFromNetworkId } from '../../../managers/network';
import { Token } from '../../../types/token';

import { SimpleDbEntityBase } from './SimpleDbEntityBase';
import { SimpleDbEntityLocalTokens } from './SimpleDbEntityPresetLocalTokens';

export type ISimpleDbEntityTokensData = {
  [key: string]: Token[];
};

const caseSensitiveImpls = new Set([IMPL_SOL]);

export class SimpleDbEntityTokens extends SimpleDbEntityBase<ISimpleDbEntityTokensData> {
  entityName = 'tokens';

  localTokens = new SimpleDbEntityLocalTokens();

  override enableCache = false;

  private defaultStableTokens: {
    [networkId: string]: string[];
  } = {};

  private saveDefaultTokenCache(data: ISimpleDbEntityTokensData) {
    for (const [networkId, tokens] of Object.entries(data)) {
      this.defaultStableTokens[networkId] = tokens.map((t) => t.address || '');
    }
  }

  private async initTop50Tokens() {
    for (const { impl, chainId, tokens } of top50) {
      await this.updateTokens(impl, chainId, tokens);
    }
  }

  async updateTokens(impl: string, chainId: number, tokens: ServerToken[]) {
    const networkId = `${impl}--${chainId}`;
    const normalizedTokens = tokens.map((t) => {
      const { address = '', logoURI } = t;
      const tokenAddress = caseSensitiveImpls.has(impl)
        ? address
        : address.toLowerCase();
      return {
        ...t,
        id: `${networkId}--${tokenAddress}`,
        networkId,
        logoURI: logoURI || '',
        tokenIdOnNetwork: tokenAddress,
        address: tokenAddress,
      };
    });
    await this.saveTokens(networkId, normalizedTokens);
  }

  async saveTokens(networkId: string, tokens: Token[]) {
    const savedTokens = await this.getRawData();
    const data = {
      ...(savedTokens || {}),
      [networkId]: tokens || [],
    };
    this.saveDefaultTokenCache(data);
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
    let tokensMap = await this.getRawData();
    if (!tokensMap) {
      await this.initTop50Tokens();
    }
    tokensMap = await this.getRawData();
    if (typeof tokensMap !== 'object' || tokensMap === null) {
      return [];
    }
    let tokens = tokensMap[networkId] ?? [];
    tokens = tokens.concat(await this.localTokens.getUnknownAccountTokens());
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
    return tokens.filter((t) => !current.removed.includes(t.id));
  }

  async addTokenToAccount(accountId: string, token: Token) {
    return this.localTokens.addToken(accountId, token);
  }

  async addToken(token: Token) {
    return this.localTokens.addTokenToUnknownAccount(token);
  }

  async removeTokenFromAccount(accountId: string, tokenId: string) {
    return this.localTokens.removeToken(accountId, tokenId);
  }

  async addDefaultToken(accountId: string, impl: string) {
    const defaultTokens = this.defaultStableTokens;
    let networkIds: string[] = Object.keys(defaultTokens).filter((v) =>
      getSupportedImpls().has(getImplFromNetworkId(v)),
    );
    if (accountId && impl) {
      // filter for account
      networkIds = networkIds.filter((v) => getImplFromNetworkId(v) === impl);
    }
    for (const networkId of networkIds) {
      const tokens = await this.getTokens({
        networkId,
        query: { addToIndex: true },
      });
      for (const token of tokens) {
        await this.addTokenToAccount(accountId, token);
      }
    }
  }
}
