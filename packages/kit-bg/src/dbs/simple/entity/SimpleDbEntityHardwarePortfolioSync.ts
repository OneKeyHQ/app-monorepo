import { SimpleDbEntityBase } from '../base/SimpleDbEntityBase';

export type IHardwarePortfolioSyncTargetState = {
  // Last real hardware upload attempt. Unlike lastTransferAt, this also
  // throttles failed BLE attempts so a noisy producer cannot keep waking the
  // device after a transient transport failure.
  lastAttemptAt?: number;
  // Content hash of the last snapshot actually submitted/uploaded for this
  // target. Used for dedup so an unchanged portfolio is not re-synced.
  lastContentHash?: string;
  // Timestamp of the last successful hardware transfer for this target. Used
  // for the transfer cooldown.
  lastTransferAt?: number;
  // Standard wallet whose snapshot was last applied. Missing legacy values
  // force one overwrite so unknown hidden-wallet remnants cannot survive.
  lastWalletId?: string;
  // Native BLE may be disabled by firmware while USB owns the device link.
  // Keep this durable across bg runtime restarts; only a successful explicit
  // mobile hardware operation is allowed to resume silent Portfolio uploads.
  bleSilentSyncDisabled?: boolean;
  bleSilentSyncDisabledAt?: number;
  bleSilentSyncDisabledReason?: 'link-disabled';
};

export type IHardwarePortfolioSyncData = {
  // Keyed by the authoritative persisted device id. Per-target state keeps
  // simultaneously connected devices in independent dedup/cooldown domains.
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
