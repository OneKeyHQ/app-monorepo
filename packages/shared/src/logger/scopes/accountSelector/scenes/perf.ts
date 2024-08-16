import type {
  IAccountSelectorFocusedWallet,
  IAccountSelectorSelectedAccount,
} from '@onekeyhq/kit-bg/src/dbs/simple/entity/SimpleDbEntityAccountSelector';
import type { IAccountDeriveTypes } from '@onekeyhq/kit-bg/src/vaults/types';
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
  public renderWalletListSideBar(params: {
    selectedAccount: IAccountSelectorSelectedAccount;
    walletsCount: number;
  }) {
    return [params];
  }

  @LogToConsole()
  public renderAccountsList({
    selectedAccount,
    editMode,
  }: {
    editMode: boolean;
    selectedAccount: IAccountSelectorSelectedAccount;
  }) {
    return [selectedAccount, editMode];
  }

  @LogToConsole()
  buildAccountSelectorAccountsListData(params: {
    focusedWallet: IAccountSelectorFocusedWallet;
    othersNetworkId?: string;
    linkedNetworkId?: string;
    deriveType: IAccountDeriveTypes;
  }) {
    return [params];
  }

  @LogToConsole()
  public renderAccountsSectionList(params: {
    accountsCount: number;
    walletName?: string;
  }) {
    return [params];
  }

  @LogToConsole()
  public renderAccountsSectionListMock() {
    return [true];
  }
}
