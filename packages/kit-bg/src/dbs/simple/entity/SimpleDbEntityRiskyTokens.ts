import { backgroundMethod } from '@onekeyhq/shared/src/background/backgroundDecorators';

import { SimpleDbEntityBase } from './SimpleDbEntityBase';

export interface IRiskyTokens {
  blockedTokens: Record<string, Record<string, boolean>>; // <networkId, <tokenIdOnNetwork: boolean>>
  unblockedTokens: Record<string, Record<string, boolean>>; // <networkId, <tokenIdOnNetwork: boolean>>
  confirmedRiskTokens: string[]; // networkId_contractAddress
}

export class SimpleDbEntityRiskyTokens extends SimpleDbEntityBase<IRiskyTokens> {
  entityName = 'riskyTokens';

  override enableCache = false;

  @backgroundMethod()
  async getBlockedTokens(networkId: string) {
    return (await this.getRawData())?.blockedTokens[networkId] ?? {};
  }

  @backgroundMethod()
  async getUnblockedTokens(networkId: string) {
    return (await this.getRawData())?.unblockedTokens[networkId] ?? {};
  }

  @backgroundMethod()
  async getConfirmedRiskTokens() {
    return (await this.getRawData())?.confirmedRiskTokens ?? [];
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
      const blockedTokensMap = blockedTokens[networkId] ?? {};
      addToBlockedTokens?.forEach((token) => {
        blockedTokensMap[token] = true;
      });
      removeFromBlockedTokens?.forEach((token) => {
        delete blockedTokensMap[token];
      });

      blockedTokens[networkId] = blockedTokensMap;

      return {
        confirmedRiskTokens: rawData?.confirmedRiskTokens ?? [],
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
      const unblockedTokensMap = unblockedTokens[networkId] ?? {};
      addToUnBlockedTokens?.forEach((token) => {
        unblockedTokensMap[token] = true;
      });
      removeFromUnBlockedTokens?.forEach((token) => {
        delete unblockedTokensMap[token];
      });

      unblockedTokens[networkId] = unblockedTokensMap;

      return {
        confirmedRiskTokens: rawData?.confirmedRiskTokens ?? [],
        blockedTokens: rawData?.blockedTokens ?? {},
        unblockedTokens,
      };
    });
  }

  @backgroundMethod()
  async addConfirmedRiskTokens(tokens: string[]) {
    await this.setRawData(({ rawData }) => ({
      blockedTokens: rawData?.blockedTokens ?? {},
      unblockedTokens: rawData?.unblockedTokens ?? {},
      confirmedRiskTokens: Array.from(
        new Set([...(rawData?.confirmedRiskTokens ?? []), ...tokens]),
      ),
    }));
  }
}
