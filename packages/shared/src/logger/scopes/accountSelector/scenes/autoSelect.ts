import { cloneDeep } from 'lodash';

import type { IAccountSelectorSelectedAccount } from '@onekeyhq/kit-bg/src/dbs/simple/entity/SimpleDbEntityAccountSelector';

import { BaseScene } from '../../../base/baseScene';
import { LogToConsole } from '../../../base/decorators';

export class AccountSelectorAutoSelectScene extends BaseScene {
  @LogToConsole()
  public startAutoSelect({
    focusedWallet,
    networkId,
    walletId,
    isAccountExist,
  }: {
    focusedWallet: string | undefined;
    networkId: string | undefined;
    walletId: string | undefined;
    isAccountExist: boolean;
  }) {
    return cloneDeep({ focusedWallet, networkId, walletId, isAccountExist });
  }

  @LogToConsole()
  public currentSelectedAccount({
    selectedAccount,
  }: {
    selectedAccount: IAccountSelectorSelectedAccount;
  }) {
    return cloneDeep({ selectedAccount });
  }

  @LogToConsole()
  public resetSelectedWalletToUndefined({
    selectedAccount,
  }: {
    selectedAccount: IAccountSelectorSelectedAccount;
  }) {
    return cloneDeep([
      'currentWallet does not exist or no indexed account',
      { walletId: selectedAccount.walletId },
      selectedAccount,
    ]);
  }
}
