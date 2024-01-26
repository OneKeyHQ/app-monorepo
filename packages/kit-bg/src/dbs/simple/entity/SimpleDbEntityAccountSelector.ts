import { backgroundMethod } from '@onekeyhq/shared/src/background/backgroundDecorators';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { checkIsDefined } from '@onekeyhq/shared/src/utils/assertUtils';
import type { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import { SimpleDbEntityBase } from './SimpleDbEntityBase';

import type { IAccountDeriveTypes } from '../../../vaults/types';
import type {
  IDBAccount,
  IDBIndexedAccount,
  IDBWalletId,
} from '../../local/types';

export type IAccountSelectorFocusedWallet =
  | IDBWalletId
  | '$$others'
  | undefined; // TODO move to standalone atom
export interface IAccountSelectorSelectedAccount {
  walletId: IDBWalletId | undefined;
  indexedAccountId: string | undefined;
  othersWalletAccountId: string | undefined; // for others wallet only
  networkId: string | undefined;
  deriveType: IAccountDeriveTypes; // TODO move to jotai global
  focusedWallet: IAccountSelectorFocusedWallet; // TODO move to standalone atom
}
export interface IAccountSelectorSelectedAccountsMap {
  [num: number]: IAccountSelectorSelectedAccount;
}
export interface IAccountSelectorSectionData {
  title: string;
  isHiddenWalletData?: boolean;
  data: IDBIndexedAccount[] | IDBAccount[];
  walletId: IDBWalletId;
}
export interface IAccountSelectorPersistInfo {
  selectorInfo: {
    [sceneId: string]: {
      selector: IAccountSelectorSelectedAccountsMap;
    };
  };
}

export class SimpleDbEntityAccountSelector extends SimpleDbEntityBase<IAccountSelectorPersistInfo> {
  entityName = 'accountSelector';

  override enableCache = false;

  @backgroundMethod()
  async saveSelectedAccount({
    selectedAccount,
    sceneName,
    sceneUrl,
    num,
  }: {
    selectedAccount: IAccountSelectorSelectedAccount;
    sceneName: EAccountSelectorSceneName;
    sceneUrl?: string;
    num: number;
  }) {
    checkIsDefined(num);
    checkIsDefined(sceneName);
    const sceneId = accountUtils.buildAccountSelectorSceneId({
      sceneName,
      sceneUrl,
    });
    await this.setRawData(({ rawData: data }) => {
      // eslint-disable-next-line no-param-reassign
      data = data || {
        selectorInfo: {},
      };
      data.selectorInfo[sceneId] = data.selectorInfo[sceneId] || {};
      data.selectorInfo[sceneId].selector =
        data.selectorInfo[sceneId].selector || {};
      data.selectorInfo[sceneId].selector[num] = selectedAccount;
      return data;
    });
    console.log('saveSelectedAccount', {
      selectedAccount,
      sceneName,
      sceneUrl,
      num,
    });
  }

  @backgroundMethod()
  async getSelectedAccountsMap({
    sceneName,
    sceneUrl,
  }: {
    sceneName: EAccountSelectorSceneName;
    sceneUrl?: string;
  }): Promise<IAccountSelectorSelectedAccountsMap | undefined> {
    const sceneId = accountUtils.buildAccountSelectorSceneId({
      sceneName,
      sceneUrl,
    });
    const data = await this.getRawData();
    // const defaultValue: IAccountSelectorSelectedAccount = {
    //   walletId: undefined,
    //   indexedAccountId: undefined,
    //   accountId: undefined,
    //   networkId: undefined,
    //   deriveType: 'default',
    //   focusedWallet: undefined,
    // };
    const result = data?.selectorInfo[sceneId]?.selector || undefined;
    return result;
  }

  @backgroundMethod()
  async getSelectedAccount({
    sceneName,
    sceneUrl,
    num,
  }: {
    sceneName: EAccountSelectorSceneName;
    sceneUrl?: string;
    num: number;
  }): Promise<IAccountSelectorSelectedAccount | undefined> {
    const selectedAccountsMap = await this.getSelectedAccountsMap({
      sceneName,
      sceneUrl,
    });
    return selectedAccountsMap?.[num];
  }
}
