import { SimpleDbEntityBase } from '../base/SimpleDbEntityBase';

// Settings shared by every privacy chain: a field belongs here only if each
// chain would need it with the same meaning. Per-chain state (birthdays,
// addresses) stays in that chain's own entity.

export interface IPrivacyChainDB {
  // Device-wide, not per network: it is about this device's data plan.
  // Absent means not allowed.
  allowCellularSync?: boolean;
  // Networks whose scan database an app reset failed to delete. Rewritten
  // after the reset clears this store; the next launch and the next reset
  // retry them.
  pendingLocalDataDrop?: string[];
}

// Builders write back known fields only, so a dropped field does not live on.
function pickKnownFields(rawData: IPrivacyChainDB | null | undefined) {
  return {
    allowCellularSync: rawData?.allowCellularSync,
    pendingLocalDataDrop: rawData?.pendingLocalDataDrop,
  };
}

export class SimpleDbEntityPrivacyChain extends SimpleDbEntityBase<IPrivacyChainDB> {
  entityName = 'privacyChain';

  override enableCache = false;

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
      ...pickKnownFields(rawData),
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
      ...pickKnownFields(rawData),
      pendingLocalDataDrop: (rawData?.pendingLocalDataDrop ?? []).filter(
        (networkId) => !networkIds.includes(networkId),
      ),
    }));
  }

  async getAllowCellularSync(): Promise<boolean> {
    const rawData = await this.getRawData();
    return rawData?.allowCellularSync === true;
  }

  async setAllowCellularSync({ allow }: { allow: boolean }): Promise<void> {
    await this.setRawData((rawData) => ({
      ...pickKnownFields(rawData),
      allowCellularSync: allow,
    }));
  }
}
