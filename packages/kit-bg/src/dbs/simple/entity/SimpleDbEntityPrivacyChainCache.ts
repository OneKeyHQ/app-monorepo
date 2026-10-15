import { SimpleDbEntityBase } from '../base/SimpleDbEntityBase';

// Results computed from a privacy chain's local scan, kept so a cold start can
// show them before the scanner answers. Unlike privacyChain (viewing keys,
// settings), anything here may be dropped at any time: the scan rebuilds it.
// Read and written only through vaults/localWallet/privacyChainCacheStore.ts.

export interface IPrivacyChainCacheDB {
  // accountId -> the last private balance read from the scanner.
  lastBalances?: Record<string, IPrivacyChainLastBalanceRecord>;
  // networkId -> the last chain tip fetched from the node, for display only.
  chainTips?: Record<string, number>;
}

export type IPrivacyChainLastBalanceRecord = {
  networkId: string;
  // Opaque here; the chain owns the format.
  value: string;
  savedAt: number;
};

export class SimpleDbEntityPrivacyChainCache extends SimpleDbEntityBase<IPrivacyChainCacheDB> {
  entityName = 'privacyChainCache';

  override enableCache = false;

  async getLastBalance({
    accountId,
  }: {
    accountId: string;
  }): Promise<IPrivacyChainLastBalanceRecord | undefined> {
    const rawData = await this.getRawData();
    return rawData?.lastBalances?.[accountId];
  }

  async setLastBalance({
    accountId,
    record,
  }: {
    accountId: string;
    record: IPrivacyChainLastBalanceRecord;
  }): Promise<void> {
    await this.setRawData((rawData) => ({
      ...rawData,
      lastBalances: { ...rawData?.lastBalances, [accountId]: record },
    }));
  }

  async removeLastBalances({
    accountIds,
  }: {
    accountIds: string[];
  }): Promise<void> {
    await this.setRawData((rawData) => {
      if (!accountIds.some((id) => rawData?.lastBalances?.[id])) {
        return rawData ?? {};
      }
      const lastBalances = { ...rawData?.lastBalances };
      accountIds.forEach((id) => {
        delete lastBalances[id];
      });
      return { ...rawData, lastBalances };
    });
  }

  async removeNetworkLastBalances({
    networkId,
  }: {
    networkId: string;
  }): Promise<void> {
    await this.setRawData((rawData) => {
      const entries = Object.entries(rawData?.lastBalances ?? {});
      if (!entries.some(([, record]) => record.networkId === networkId)) {
        return rawData ?? {};
      }
      return {
        ...rawData,
        lastBalances: Object.fromEntries(
          entries.filter(([, record]) => record.networkId !== networkId),
        ),
      };
    });
  }

  async getChainTip({
    networkId,
  }: {
    networkId: string;
  }): Promise<number | undefined> {
    const rawData = await this.getRawData();
    return rawData?.chainTips?.[networkId];
  }

  async setChainTip({
    networkId,
    height,
  }: {
    networkId: string;
    height: number;
  }): Promise<void> {
    await this.setRawData((rawData) => ({
      ...rawData,
      chainTips: { ...rawData?.chainTips, [networkId]: height },
    }));
  }

  async listLastBalanceAccountIds(): Promise<string[]> {
    const rawData = await this.getRawData();
    return Object.keys(rawData?.lastBalances ?? {});
  }
}
