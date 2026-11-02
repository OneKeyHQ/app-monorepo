import { BaseScene } from '../../../base/baseScene';
import { LogToServer } from '../../../base/decorators';

// Never carries keys, addresses, viewing-key fingerprints, birthdays, heights
// or amounts: only the network, the wallet kind and coarse categories.
export type IPrivacyChainWalletType = 'hd' | 'hw' | 'other';

export type IPrivacyEnableFailureReason =
  | 'user_cancelled'
  | 'device_error'
  | 'limit_reached'
  | 'storage_unsupported'
  | 'node_unreachable'
  | 'unknown';

export type IPrivacyFirstSyncFailureReason =
  | 'runtime_unavailable'
  | 'node_unreachable'
  | 'timeout'
  | 'storage_unsupported'
  | 'failed';

// Coarse bucket of a duration: the exact time of a sync is not reported.
export type IPrivacySyncDurationBucket =
  | 'under_5m'
  | '5m_30m'
  | '30m_2h'
  | '2h_6h'
  | 'over_6h';

type IPrivacyChainEventBase = {
  networkId: string;
  walletType: IPrivacyChainWalletType;
};

export class PrivacyChainScene extends BaseScene {
  @LogToServer()
  public privacyEnabled(params: IPrivacyChainEventBase) {
    return params;
  }

  @LogToServer()
  public privacyEnableFailed(
    params: IPrivacyChainEventBase & { reason: IPrivacyEnableFailureReason },
  ) {
    return params;
  }

  // From the enable to the first pass that reached the chain tip.
  @LogToServer()
  public privacyFirstSyncCompleted(
    params: IPrivacyChainEventBase & {
      durationBucket: IPrivacySyncDurationBucket;
    },
  ) {
    return params;
  }

  // The first failed pass before the first sync completed; sent once, and
  // the completion event may still follow after automatic retries.
  @LogToServer()
  public privacyFirstSyncFailed(
    params: IPrivacyChainEventBase & {
      durationBucket: IPrivacySyncDurationBucket;
      reason: IPrivacyFirstSyncFailureReason;
    },
  ) {
    return params;
  }
}
