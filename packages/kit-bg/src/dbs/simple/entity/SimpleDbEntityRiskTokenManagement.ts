import { backgroundMethod } from '@onekeyhq/shared/src/background/backgroundDecorators';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';

import { SimpleDbEntityBase } from '../base/SimpleDbEntityBase';

export interface IRiskTokenManagement {
  unblockedTokens: Record<string, Record<string, boolean>>; // <networkId, Record<tokenAddress, boolean>>
}

export class SimpleDbEntityRiskTokenManagement extends SimpleDbEntityBase<IRiskTokenManagement> {
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
  async getUnblockedTokensInAllNetworks() {
    const rawData = await this.getRawData();
    return rawData?.unblockedTokens ?? {};
  }

  @backgroundMethod()
  async updateUnblockedTokens(data: Record<string, Record<string, boolean>>) {
    // merge each network's unblocked tokens
    const mergedData = Object.entries(data).reduce(
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
        ...mergedData,
      },
    }));
  }
}
