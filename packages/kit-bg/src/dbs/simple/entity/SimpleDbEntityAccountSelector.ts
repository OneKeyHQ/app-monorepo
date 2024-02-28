import { backgroundMethod } from '@onekeyhq/shared/src/background/backgroundDecorators';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import accountSelectorUtils from '@onekeyhq/shared/src/utils/accountSelectorUtils';
import { checkIsDefined } from '@onekeyhq/shared/src/utils/assertUtils';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

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
export type IAccountSelectorSelectedAccountsMap = Partial<{
  [num: number]: IAccountSelectorSelectedAccount;
}>;
export interface IAccountSelectorAccountsListSectionData {
  title: string;
  isHiddenWalletData?: boolean;
  data: IDBIndexedAccount[] | IDBAccount[];
  walletId: IDBWalletId;
}
export type IGlobalDeriveTypesMap = Partial<{
  [networkIdOrImpl: string]: IAccountDeriveTypes;
}>;
export enum EGlobalDeriveTypesScopes {
  global = 'global',
  swapTo = 'swapTo',
}
export interface IAccountSelectorPersistInfo {
  selectorInfo: {
    [sceneId: string]: {
      selector: IAccountSelectorSelectedAccountsMap;
    };
  };
  globalDeriveTypesMap: Partial<
    Record<EGlobalDeriveTypesScopes, IGlobalDeriveTypesMap>
  >;
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
    if (sceneName === EAccountSelectorSceneName.discover) {
      console.log('skip discover account selector persist');
      return;
    }
    const sceneId = accountSelectorUtils.buildAccountSelectorSceneId({
      sceneName,
      sceneUrl,
    });
    await this.setRawData(({ rawData: data }) => {
      // eslint-disable-next-line no-param-reassign
      data = data || {
        selectorInfo: {},
        globalDeriveTypesMap: {},
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
    const sceneId = accountSelectorUtils.buildAccountSelectorSceneId({
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

  async getGlobalDeriveType({
    networkId,
  }: {
    networkId: string;
  }): Promise<IAccountDeriveTypes | undefined> {
    const scope = EGlobalDeriveTypesScopes.global; // shared scope
    // TODO swapTo scope
    const map = (await this.getRawData())?.globalDeriveTypesMap[scope];
    const key = accountSelectorUtils.buildGlobalDeriveTypesMapKey({
      networkId,
    });
    const deriveType = map?.[key];
    return deriveType;
  }

  async saveGlobalDeriveType({
    networkId,
    deriveType,
    eventEmitDisabled,
  }: {
    networkId: string;
    deriveType: IAccountDeriveTypes;
    eventEmitDisabled?: boolean;
  }) {
    const scope = EGlobalDeriveTypesScopes.global; // shared scope
    const key = accountSelectorUtils.buildGlobalDeriveTypesMapKey({
      networkId,
    });
    await this.setRawData(({ rawData }) => {
      if (!rawData) {
        throw new Error('rawData is undefined');
      }
      rawData.globalDeriveTypesMap = rawData?.globalDeriveTypesMap || {};
      rawData.globalDeriveTypesMap[scope] =
        rawData.globalDeriveTypesMap[scope] || {};
      if (rawData.globalDeriveTypesMap[scope][key] !== deriveType) {
        rawData.globalDeriveTypesMap[scope][key] = deriveType;
        if (!eventEmitDisabled) {
          setTimeout(() => {
            appEventBus.emit(
              EAppEventBusNames.GlobalDeriveTypeUpdate,
              undefined,
            );
          }, 100);
        }
      }
      return rawData;
    });
  }
}
