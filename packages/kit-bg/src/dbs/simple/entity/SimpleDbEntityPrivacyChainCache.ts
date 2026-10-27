import { SimpleDbEntityBase } from '../base/SimpleDbEntityBase';

// Droppable cache of local scan results; the scan rebuilds it.

export interface IPrivacyChainCacheDB {
  lastBalances?: Record<string, IPrivacyChainLastBalanceRecord>;
  lastPublicBalances?: Record<string, IPrivacyChainLastPublicBalanceRecord>;
  chainTips?: Record<string, number>;
  // Successful catch-up, independent of whether the balance amount changed.
  lastSyncs?: Record<
    string,
    { networkId: string; epoch: string; syncedAt: number }
  >;
}

export type IPrivacyChainLastBalanceRecord = {
  networkId: string;
  epoch?: string;
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

  async getLastSync({ accountId }: { accountId: string }) {
    return (await this.getRawData())?.lastSyncs?.[accountId];
  }

  async setLastSync({
    accountId,
    record,
    isCurrent,
  }: {
    accountId: string;
    record: NonNullable<IPrivacyChainCacheDB['lastSyncs']>[string];
    isCurrent: () => Promise<boolean>;
  }): Promise<void> {
    await this.setRawData(async (raw) => {
      if (!(await isCurrent())) return raw ?? {};
      return { ...raw, lastSyncs: { ...raw?.lastSyncs, [accountId]: record } };
    });
  }

  async getLastBalance({
    accountId,
  }: {
    accountId: string;
  }): Promise<IPrivacyChainLastBalanceRecord | undefined> {
    const rawData = await this.getRawData();
    return rawData?.lastBalances?.[accountId];
  }

  // `isCurrent` runs under the entity lock right before the write; a value read before its data was destroyed is dropped.
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
            rawData?.lastBalances?.[id] ||
            rawData?.lastPublicBalances?.[id] ||
            rawData?.lastSyncs?.[id],
        )
      ) {
        return rawData ?? {};
      }
      const lastBalances = { ...rawData?.lastBalances };
      const lastPublicBalances = { ...rawData?.lastPublicBalances };
      const lastSyncs = { ...rawData?.lastSyncs };
      accountIds.forEach((id) => {
        delete lastBalances[id];
        delete lastPublicBalances[id];
        delete lastSyncs[id];
      });
      return { ...rawData, lastBalances, lastPublicBalances, lastSyncs };
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
      const syncEntries = Object.entries(rawData?.lastSyncs ?? {});
      if (
        ![...entries, ...publicEntries, ...syncEntries].some(
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
        lastSyncs: Object.fromEntries(
          syncEntries.filter(([, record]) => record.networkId !== networkId),
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
        ...Object.keys(rawData?.lastSyncs ?? {}),
      ]),
    ];
  }
}
