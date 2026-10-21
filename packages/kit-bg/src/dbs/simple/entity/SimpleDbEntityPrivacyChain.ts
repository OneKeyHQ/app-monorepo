import { SimpleDbEntityBase } from '../base/SimpleDbEntityBase';

// Settings shared by every privacy chain: a field belongs here only if each
// chain would need it with the same meaning. Per-chain state (birthdays,
// addresses) stays in that chain's own entity.

export interface IPrivacyChainDB {
  // accountId -> the one-time "where should scanning start?" prompt has been
  // shown. The answer itself is chain-shaped and stays with the chain.
  scanStartPrompted?: Record<string, boolean>;
  // Device-wide, not per network: it is about this device's data plan.
  // Absent means not allowed.
  allowCellularSync?: boolean;
  // Networks whose scan database an app reset failed to delete. Rewritten
  // after the reset clears this store; the next launch and the next reset
  // retry them.
  pendingLocalDataDrop?: string[];
  // accountId -> the chain's viewing material (Zcash UFVK, Monero view key
  // pair); `value` is opaque here, its chain owns the format. Read and written
  // only through vaults/localWallet/viewingKeyStore.ts.
  viewingKeys?: Record<string, IPrivacyChainViewingKeyRecord>;
}

export type IPrivacyChainViewingKeyRecord = {
  networkId: string;
  value: string;
};

export class SimpleDbEntityPrivacyChain extends SimpleDbEntityBase<IPrivacyChainDB> {
  entityName = 'privacyChain';

  override enableCache = false;

  async getScanStartPrompted({
    accountId,
  }: {
    accountId: string;
  }): Promise<boolean> {
    const rawData = await this.getRawData();
    return rawData?.scanStartPrompted?.[accountId] === true;
  }

  async markScanStartPrompted({ accountId }: { accountId: string }) {
    await this.setRawData((rawData) => ({
      ...rawData,
      scanStartPrompted: {
        ...rawData?.scanStartPrompted,
        [accountId]: true,
      },
    }));
  }

  async removeScanStartPrompted({ accountId }: { accountId: string }) {
    await this.setRawData((rawData) => {
      if (!rawData?.scanStartPrompted?.[accountId]) {
        return rawData ?? {};
      }
      const { [accountId]: _removed, ...rest } = rawData.scanStartPrompted;
      return { ...rawData, scanStartPrompted: rest };
    });
  }

  async getPendingLocalDataDrop(): Promise<string[]> {
    const rawData = await this.getRawData();
    return rawData?.pendingLocalDataDrop ?? [];
  }

  async setPendingLocalDataDrop({
    networkIds,
  }: {
    networkIds: string[];
  }): Promise<void> {
    await this.setRawData((rawData) => ({
      ...rawData,
      pendingLocalDataDrop: networkIds,
    }));
  }

  // Removes only the given networks: a reset may have marked others since
  // they were read.
  async removePendingLocalDataDrop({
    networkIds,
  }: {
    networkIds: string[];
  }): Promise<void> {
    await this.setRawData((rawData) => ({
      ...rawData,
      pendingLocalDataDrop: (rawData?.pendingLocalDataDrop ?? []).filter(
        (networkId) => !networkIds.includes(networkId),
      ),
    }));
  }

  async getViewingKey({
    accountId,
  }: {
    accountId: string;
  }): Promise<IPrivacyChainViewingKeyRecord | undefined> {
    const rawData = await this.getRawData();
    return rawData?.viewingKeys?.[accountId];
  }

  async setViewingKey({
    accountId,
    record,
  }: {
    accountId: string;
    record: IPrivacyChainViewingKeyRecord;
  }): Promise<void> {
    await this.setRawData((rawData) => ({
      ...rawData,
      viewingKeys: { ...rawData?.viewingKeys, [accountId]: record },
    }));
  }

  async removeViewingKeys({
    accountIds,
  }: {
    accountIds: string[];
  }): Promise<void> {
    await this.setRawData((rawData) => {
      if (!accountIds.some((id) => rawData?.viewingKeys?.[id])) {
        return rawData ?? {};
      }
      const viewingKeys = { ...rawData?.viewingKeys };
      accountIds.forEach((id) => {
        delete viewingKeys[id];
      });
      return { ...rawData, viewingKeys };
    });
  }

  async listViewingKeyAccountIds(): Promise<string[]> {
    const rawData = await this.getRawData();
    return Object.keys(rawData?.viewingKeys ?? {});
  }

  async getAllowCellularSync(): Promise<boolean> {
    const rawData = await this.getRawData();
    return rawData?.allowCellularSync === true;
  }

  async setAllowCellularSync({ allow }: { allow: boolean }): Promise<void> {
    await this.setRawData((rawData) => ({
      ...rawData,
      allowCellularSync: allow,
    }));
  }
}
