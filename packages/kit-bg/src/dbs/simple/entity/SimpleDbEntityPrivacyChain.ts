import { SimpleDbEntityBase } from '../base/SimpleDbEntityBase';

// Settings that belong to the PRIVACY-CHAIN CATEGORY, not to any one chain.
//
// ServicePrivacyChain is documented as chain-agnostic, so anything it reads or
// writes has to live somewhere a second privacy chain can share. State that is
// genuinely per-chain (Zcash birthdays, unified addresses) stays in that
// chain's own entity.
//
// The test for what belongs here: would Monero need the same field, with the
// same meaning? "May I sync over mobile data" passes. "Which block did this
// account start at" does not -- that is per-chain, even though every scanning
// chain has some version of it.

export interface IPrivacyChainDB {
  // Whether a full-speed catch-up may run on a metered connection. Global on
  // purpose: this is the user answering "spend my data allowance", which is
  // not a question they should have to answer once per chain.
  allowCellularSync?: boolean;
  // accountId -> the one-time "where should scanning start?" prompt has been
  // shown. Every client-scanning chain has this question; only the ANSWER
  // (a block height, a restore date) is chain-shaped, and that stays with the
  // chain. Losing this flag costs one repeated prompt, nothing more.
  scanStartPrompted?: Record<string, boolean>;
  // networkId -> runtime storage schema version last seen. A mismatch means
  // the chain's local database must be rebuilt from viewing keys; the
  // database file itself carries no app-readable tag.
  runtimeSchemaVersions?: Record<string, string>;
}

export class SimpleDbEntityPrivacyChain extends SimpleDbEntityBase<IPrivacyChainDB> {
  entityName = 'privacyChain';

  override enableCache = false;

  async getAllowCellularSync(): Promise<boolean> {
    const rawData = await this.getRawData();
    return rawData?.allowCellularSync === true;
  }

  async saveAllowCellularSync({ allow }: { allow: boolean }) {
    await this.setRawData((rawData) => ({
      ...rawData,
      allowCellularSync: allow,
    }));
  }

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

  async getRuntimeSchemaVersion({
    networkId,
  }: {
    networkId: string;
  }): Promise<string | undefined> {
    const rawData = await this.getRawData();
    return rawData?.runtimeSchemaVersions?.[networkId];
  }

  async saveRuntimeSchemaVersion({
    networkId,
    version,
  }: {
    networkId: string;
    version: string;
  }) {
    await this.setRawData((rawData) => ({
      ...rawData,
      runtimeSchemaVersions: {
        ...rawData?.runtimeSchemaVersions,
        [networkId]: version,
      },
    }));
  }
}
