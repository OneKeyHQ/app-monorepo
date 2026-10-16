import { SimpleDbEntityBase } from '../base/SimpleDbEntityBase';

// Results computed from a privacy chain's local scan (plus the last public-side
// balance), kept so a cold start can show them before a live read answers. Unlike privacyChain (viewing keys,
// settings), anything here may be dropped at any time: the scan rebuilds it.
// Read and written only through vaults/localWallet/privacyChainCacheStore.ts.

export interface IPrivacyChainCacheDB {
  // accountId -> the last private balance read from the scanner.
  lastBalances?: Record<string, IPrivacyChainLastBalanceRecord>;
  // accountId -> the last public-side balance fetched from the backend.
  lastPublicBalances?: Record<string, IPrivacyChainLastPublicBalanceRecord>;
  // networkId -> the last chain tip fetched from the node, for display only.
  chainTips?: Record<string, number>;
}

export type IPrivacyChainLastBalanceRecord = {
  networkId: string;
  // Opaque here; the chain owns the format.
  value: string;
  savedAt: number;
};

export type IPrivacyChainLastPublicBalanceRecord = {
  networkId: string;
  // Base units, both from the same read.
  total: string;
  spendable: string;
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

  async getLastPublicBalance({
    accountId,
  }: {
    accountId: string;
  }): Promise<IPrivacyChainLastPublicBalanceRecord | undefined> {
    const rawData = await this.getRawData();
    return rawData?.lastPublicBalances?.[accountId];
  }

  async setLastPublicBalance({
    accountId,
    record,
  }: {
    accountId: string;
    record: IPrivacyChainLastPublicBalanceRecord;
  }): Promise<void> {
    await this.setRawData((rawData) => ({
      ...rawData,
      lastPublicBalances: {
        ...rawData?.lastPublicBalances,
        [accountId]: record,
      },
    }));
  }

  // Removes both halves: a saved public balance never outlives the private one.
  async removeLastBalances({
    accountIds,
  }: {
    accountIds: string[];
  }): Promise<void> {
    await this.setRawData((rawData) => {
      if (
        !accountIds.some(
          (id) =>
            rawData?.lastBalances?.[id] || rawData?.lastPublicBalances?.[id],
        )
      ) {
        return rawData ?? {};
      }
      const lastBalances = { ...rawData?.lastBalances };
      const lastPublicBalances = { ...rawData?.lastPublicBalances };
      accountIds.forEach((id) => {
        delete lastBalances[id];
        delete lastPublicBalances[id];
      });
      return { ...rawData, lastBalances, lastPublicBalances };
    });
  }

  async removeNetworkLastBalances({
    networkId,
  }: {
    networkId: string;
  }): Promise<void> {
    await this.setRawData((rawData) => {
      const entries = Object.entries(rawData?.lastBalances ?? {});
      const publicEntries = Object.entries(rawData?.lastPublicBalances ?? {});
      if (
        ![...entries, ...publicEntries].some(
          ([, record]) => record.networkId === networkId,
        )
      ) {
        return rawData ?? {};
      }
      return {
        ...rawData,
        lastBalances: Object.fromEntries(
          entries.filter(([, record]) => record.networkId !== networkId),
        ),
        lastPublicBalances: Object.fromEntries(
          publicEntries.filter(([, record]) => record.networkId !== networkId),
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
    return [
      ...new Set([
        ...Object.keys(rawData?.lastBalances ?? {}),
        ...Object.keys(rawData?.lastPublicBalances ?? {}),
      ]),
    ];
  }
}
