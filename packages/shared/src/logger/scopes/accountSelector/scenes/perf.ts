import type {
  IDBAccount,
  IDBIndexedAccount,
  IDBWallet,
} from '@onekeyhq/kit-bg/src/dbs/local/types';
import type {
  IAccountSelectorFocusedWallet,
  IAccountSelectorSelectedAccount,
} from '@onekeyhq/kit-bg/src/dbs/simple/entity/SimpleDbEntityAccountSelector';
import type { IAccountDeriveTypes } from '@onekeyhq/kit-bg/src/vaults/types';
import type { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import { BaseScene } from '../../../base/baseScene';
import { LogToConsole } from '../../../base/decorators';

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
    walletName: string | undefined;
    accountsCount: number;
  }) {
    return [params];
  }

  @LogToConsole()
  public render_Accounts_SectionList_Mock() {
    return [true];
  }

  @LogToConsole()
  public renderWalletOptions({ wallet }: { wallet: IDBWallet | undefined }) {
    return [wallet?.name];
  }

  @LogToConsole()
  public renderAccountEditOptions({
    wallet,
    indexedAccount,
    account,
  }: {
    wallet: IDBWallet | undefined;
    indexedAccount?: IDBIndexedAccount;
    account?: IDBAccount;
  }) {
    return [wallet?.name, indexedAccount?.name, account?.name];
  }
}
