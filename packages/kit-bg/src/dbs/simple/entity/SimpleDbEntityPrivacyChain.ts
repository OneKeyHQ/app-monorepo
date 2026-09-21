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
  // accountId -> the one-time "where should scanning start?" prompt has been
  // shown. Every client-scanning chain has this question; only the ANSWER
  // (a block height, a restore date) is chain-shaped, and that stays with the
  // chain. Losing this flag costs one repeated prompt, nothing more.
  scanStartPrompted?: Record<string, boolean>;
  // Device-wide, not per network: it is a statement about this phone's data
  // plan, and a scan that is not allowed to spend mobile data is not allowed
  // to spend it for any chain. Absent means not allowed.
  allowCellularSync?: boolean;
  // networkId -> spend public funds before private ones when sending to a
  // private address. Network-wide on purpose: it is a statement about how the
  // user wants this CHAIN to behave, and a per-account version only invited
  // the question of which account a given send was going to use. Absent means
  // the private-by-default answer, which is the one that leaks nothing.
  preferPublicSends?: Record<string, boolean>;
}

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

  async getPreferPublicSends({
    networkId,
  }: {
    networkId: string;
  }): Promise<boolean> {
    const rawData = await this.getRawData();
    return rawData?.preferPublicSends?.[networkId] === true;
  }

  async setPreferPublicSends({
    networkId,
    preferPublic,
  }: {
    networkId: string;
    preferPublic: boolean;
  }): Promise<void> {
    await this.setRawData((rawData) => ({
      ...rawData,
      preferPublicSends: {
        ...rawData?.preferPublicSends,
        [networkId]: preferPublic,
      },
    }));
  }
}
