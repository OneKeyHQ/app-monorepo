import { backgroundMethod } from '@onekeyhq/shared/src/background/backgroundDecorators';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';

import { SimpleDbEntityBase } from '../base/SimpleDbEntityBase';

export interface IRiskTokenManagementDBStruct {
  unblockedTokens: Record<string, Record<string, boolean>>; // <networkId, Record<tokenAddress, boolean>>
  blockedTokens: Record<string, Record<string, boolean>>; // <networkId, Record<tokenAddress, boolean>>
}

export class SimpleDbEntityRiskTokenManagement extends SimpleDbEntityBase<IRiskTokenManagementDBStruct> {
  entityName = 'riskTokenManagement';

  override enableCache = false;

  @backgroundMethod()
  async getUnblockedTokens({ networkId }: { networkId: string }) {
    const rawData = await this.getRawData();

    if (networkUtils.isAllNetwork({ networkId })) {
      return rawData?.unblockedTokens ?? {};
    }

    return {
      [networkId]: rawData?.unblockedTokens?.[networkId] ?? {},
    };
  }

  @backgroundMethod()
  async getBlockedTokens({ networkId }: { networkId: string }) {
    const rawData = await this.getRawData();

    if (networkUtils.isAllNetwork({ networkId })) {
      return rawData?.blockedTokens ?? {};
    }

    return {
      [networkId]: rawData?.blockedTokens?.[networkId] ?? {},
    };
  }

  @backgroundMethod()
  async updateRiskTokensState({
    blockedTokens,
    unblockedTokens,
  }: {
    blockedTokens: Record<string, Record<string, boolean>>;
    unblockedTokens: Record<string, Record<string, boolean>>;
  }) {
    // merge each network's unblocked tokens
    const mergedUnblockedTokens = Object.entries(unblockedTokens).reduce(
      (acc, [networkId, tokens]) => {
        acc[networkId] = {
          ...(acc[networkId] ?? {}),
          ...tokens,
        };
        return acc;
      },
      {} as Record<string, Record<string, boolean>>,
    );

    // merge each network's blocked tokens
    const mergedBlockedTokens = Object.entries(blockedTokens).reduce(
      (acc, [networkId, tokens]) => {
        acc[networkId] = {
          ...(acc[networkId] ?? {}),
          ...tokens,
        };
        return acc;
      },
      {} as Record<string, Record<string, boolean>>,
    );

    await this.setRawData((rawData) => ({
      unblockedTokens: {
        ...rawData?.unblockedTokens,
        ...mergedUnblockedTokens,
      },
      blockedTokens: {
        ...rawData?.blockedTokens,
        ...mergedBlockedTokens,
      },
    }));
  }
}
