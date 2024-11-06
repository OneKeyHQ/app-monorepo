import { BaseScope } from '../../base/baseScope';
import { EScopeName } from '../../types';

import { CreateAccountPerfScene } from './scenes/accountCreatePerf';
import { AllNetworkAccountPerf } from './scenes/allNetworkAccountPerf';
import { BatchCreateAccountPerfScene } from './scenes/batchCreatePerf';
import { SecretPerfScene } from './scenes/secretPerf';
import { WalletScene } from './scenes/wallet';

export class AccountScope extends BaseScope {
  protected override scopeName = EScopeName.account;

  wallet = this.createScene('wallet', WalletScene);

  batchCreatePerf = this.createScene(
    'batchCreatePerf',
    BatchCreateAccountPerfScene,
  );

  accountCreatePerf = this.createScene(
    'accountCreatePerf',
    CreateAccountPerfScene,
  );

  secretPerf = this.createScene('secretPerf', SecretPerfScene);

  allNetworkAccountPerf = this.createScene(
    'allNetworkAccountPerf',
    AllNetworkAccountPerf,
  );
}
