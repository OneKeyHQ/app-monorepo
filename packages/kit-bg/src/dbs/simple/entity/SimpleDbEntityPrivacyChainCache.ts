import { SimpleDbEntityBase } from '../base/SimpleDbEntityBase';

// Results of a privacy chain's local scan (plus the last public-side balance),
// kept so a cold start can show them before a live read answers. Unlike
// privacyChainState, anything here may be dropped at any time: the scan
// rebuilds it. Read and written only through
// vaults/localWallet/privacyChainCacheStore.ts.

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
  // The account's epoch when the value was read (see privacyChainState);
  // absent when the account had no record yet.
  epoch?: string;
  // Opaque here; the chain owns the format.
  value: string;
  savedAt: number;
};

export type IPrivacyChainLastPublicBalanceRecord = {
  networkId: string;
  epoch?: string;
  // Base units, both from the same read.
  total: string;
  spendable: string;
  savedAt: number;
};

type ICacheKind = 'lastBalances' | 'lastPublicBalances';

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

  // `isCurrent` runs under this entity's lock, right before the write: a
  // value read before its scanned data was destroyed is dropped there, and
  // one that passes is deleted by that destruction, which deletes caches
  // after it rotates the epoch.
  async setLastBalance({
    accountId,
    record,
    isCurrent,
  }: {
    accountId: string;
    record: IPrivacyChainLastBalanceRecord;
    isCurrent: () => Promise<boolean>;
  }): Promise<void> {
    await this.setRawData(async (rawData) => {
      if (!(await isCurrent())) return rawData ?? {};
      return {
        ...rawData,
        lastBalances: { ...rawData?.lastBalances, [accountId]: record },
      };
    });
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
    isCurrent,
  }: {
    accountId: string;
    record: IPrivacyChainLastPublicBalanceRecord;
    isCurrent: () => Promise<boolean>;
  }): Promise<void> {
    await this.setRawData(async (rawData) => {
      if (!(await isCurrent())) return rawData ?? {};
      return {
        ...rawData,
        lastPublicBalances: {
          ...rawData?.lastPublicBalances,
          [accountId]: record,
        },
      };
    });
  }

  // A read found this entry stale; one written since is left alone.
  async removeStaleBalance({
    kind,
    accountId,
    epoch,
  }: {
    kind: ICacheKind;
    accountId: string;
    epoch: string | undefined;
  }): Promise<void> {
    await this.setRawData((rawData) => {
      const records = rawData?.[kind];
      if (!records?.[accountId] || records[accountId].epoch !== epoch) {
        return rawData ?? {};
      }
      const next = { ...records };
      delete next[accountId];
      return { ...rawData, [kind]: next };
    });
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

  async clearBalances(): Promise<void> {
    await this.setRawData((rawData) => ({
      chainTips: rawData?.chainTips,
    }));
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

  // One network's tip, or every network's.
  async removeChainTips({ networkId }: { networkId?: string }): Promise<void> {
    await this.setRawData((rawData) => {
      if (networkId === undefined) {
        return { ...rawData, chainTips: {} };
      }
      const chainTips = { ...rawData?.chainTips };
      delete chainTips[networkId];
      return { ...rawData, chainTips };
    });
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
