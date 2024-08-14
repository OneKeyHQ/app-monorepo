import type { IAccountSelectorSelectedAccount } from '@onekeyhq/kit-bg/src/dbs/simple/entity/SimpleDbEntityAccountSelector';
import type { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import { BaseScene } from '../../../base/baseScene';
import { LogToConsole } from '../../../decorators';

export class AccountSelectorPerfScene extends BaseScene {
  @LogToConsole()
  public buildActiveAccountInfoFromSelectedAccount({
    selectedAccount,
  }: {
    selectedAccount: IAccountSelectorSelectedAccount;
  }) {
    return [selectedAccount];
  }

  @LogToConsole()
  public showAccountSelector(params: {
    sceneName: EAccountSelectorSceneName;
    sceneUrl?: string;
    num: number;
  }) {
    return [params];
  }

  @LogToConsole()
  public renderAccountSelectorModal(params: {
    sceneName: EAccountSelectorSceneName;
    sceneUrl?: string;
    num: number;
  }) {
    return [params];
  }

  @LogToConsole()
  public buildWalletListSideBarData() {
    return [true];
  }

  @LogToConsole()
  public renderWalletListSideBar({
    selectedAccount,
  }: {
    selectedAccount: IAccountSelectorSelectedAccount;
  }) {
    return [selectedAccount];
  }

  @LogToConsole()
  public renderAccountList({
    selectedAccount,
  }: {
    selectedAccount: IAccountSelectorSelectedAccount;
  }) {
    return [selectedAccount];
  }
}
