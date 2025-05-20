import type { INetworkAccount } from '@onekeyhq/shared/types/account';

import { BaseScene } from '../../../base/baseScene';
import { LogToLocal } from '../../../base/decorators';

export class AccountScene extends BaseScene {
  @LogToLocal()
  public printAccount({ account }: { account: INetworkAccount }) {
    return {
      account,
    };
  }
}
