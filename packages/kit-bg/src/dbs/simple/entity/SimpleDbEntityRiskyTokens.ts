import { backgroundMethod } from '@onekeyhq/shared/src/background/backgroundDecorators';

import { SimpleDbEntityBase } from './SimpleDbEntityBase';

export interface IRiskyTokens {
  blockedTokens: Record<string, string[]>; // <networkId, tokenIdOnNetwork[]>
  unblockedTokens: Record<string, string[]>; // <networkId, tokenIdOnNetwork[]>
}

export class SimpleDbEntityRiskyTokens extends SimpleDbEntityBase<IRiskyTokens> {
  entityName = 'riskyTokens';

  override enableCache = false;

  @backgroundMethod()
  async getBlockedTokens(networkId: string) {
    return (await this.getRawData())?.blockedTokens[networkId] ?? [];
  }

  @backgroundMethod()
  async getUnblockedTokens(networkId: string) {
    return (await this.getRawData())?.unblockedTokens[networkId] ?? [];
  }

  @backgroundMethod()
  async updateBlockedTokens({
    networkId,
    addToBlockedTokens,
    removeFromBlockedTokens,
  }: {
    networkId: string;
    addToBlockedTokens?: string[];
    removeFromBlockedTokens?: string[];
  }) {
    await this.setRawData(({ rawData }) => {
      const blockedTokens = rawData?.blockedTokens ?? {};
      const blockedTokensSet = new Set(blockedTokens[networkId]);
      addToBlockedTokens?.forEach((token) => {
        blockedTokensSet.add(token);
      });
      removeFromBlockedTokens?.forEach((token) => {
        blockedTokensSet.delete(token);
      });

      blockedTokens[networkId] = Array.from(blockedTokensSet);

      return {
        blockedTokens,
        unblockedTokens: rawData?.unblockedTokens ?? {},
      };
    });
  }

  @backgroundMethod()
  async updateUnblockedTokens({
    networkId,
    addToUnBlockedTokens,
    removeFromUnBlockedTokens,
  }: {
    networkId: string;
    addToUnBlockedTokens?: string[];
    removeFromUnBlockedTokens?: string[];
  }) {
    await this.setRawData(({ rawData }) => {
      const unblockedTokens = rawData?.unblockedTokens ?? {};
      const unblockedTokensSet = new Set(unblockedTokens[networkId]);
      addToUnBlockedTokens?.forEach((token) => {
        unblockedTokensSet.add(token);
      });
      removeFromUnBlockedTokens?.forEach((token) => {
        unblockedTokensSet.delete(token);
      });

      unblockedTokens[networkId] = Array.from(unblockedTokensSet);

      return { blockedTokens: rawData?.blockedTokens ?? {}, unblockedTokens };
    });
  }
}
