import { BaseScene } from '../../../base/baseScene';
import { LogToLocal } from '../../../base/decorators';

export class HomeOwnerPerfScene extends BaseScene {
  @LogToLocal({ level: 'info' })
  public transition(params: {
    stage:
      | 'started'
      | 'cachePrepared'
      | 'storeCommitted'
      | 'nativeControllerReplaced';
    previousWalletName?: string;
    previousAccountName?: string;
    walletName?: string;
    accountName?: string;
    cacheOutcome?: 'hit' | 'miss' | 'async' | 'disabled' | 'ownerCleared';
    elapsedMs: number;
    storeCommitId?: number;
    controllerReused?: boolean;
    previousPartitionTag?: string;
    nextPartitionTag?: string;
  }) {
    return params;
  }
}
