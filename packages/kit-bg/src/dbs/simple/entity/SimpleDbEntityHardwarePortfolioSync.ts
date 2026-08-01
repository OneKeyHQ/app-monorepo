import { SimpleDbEntityBase } from '../base/SimpleDbEntityBase';

export type IHardwarePortfolioSyncTargetState = {
  // Content hash of the last snapshot actually submitted/uploaded for this
  // target. Used for dedup so an unchanged portfolio is not re-synced.
  lastContentHash?: string;
  // Timestamp of the last successful hardware transfer for this target. Used
  // for the transfer cooldown.
  lastTransferAt?: number;
};

export type IHardwarePortfolioSyncData = {
  // Keyed by the sync target: hardware device `connectId` when available,
  // otherwise the `walletId`. Per-target so multiple simultaneously-connected
  // devices each keep their own dedup/cooldown state.
  targets: Record<string, IHardwarePortfolioSyncTargetState>;
};

export class SimpleDbEntityHardwarePortfolioSync extends SimpleDbEntityBase<IHardwarePortfolioSyncData> {
  entityName = 'hardwarePortfolioSync';

  override enableCache = false;

  async getTargetState(
    targetKey: string,
  ): Promise<IHardwarePortfolioSyncTargetState | undefined> {
    if (!targetKey) {
      return undefined;
    }
    const data = await this.getRawData();
    return data?.targets?.[targetKey];
  }

  async updateTargetState(
    targetKey: string,
    patch: IHardwarePortfolioSyncTargetState,
  ): Promise<void> {
    if (!targetKey) {
      return;
    }
    // setRawData runs the updater under a mutex, so concurrent per-target
    // writes merge instead of clobbering each other.
    await this.setRawData((rawData) => {
      const targets = { ...rawData?.targets };
      targets[targetKey] = { ...targets[targetKey], ...patch };
      return { targets };
    });
  }
}
