import { useMemo } from 'react';

import type {
  IDBAccount,
  IDBDevice,
  IDBIndexedAccount,
  IDBWallet,
} from '@onekeyhq/kit-bg/src/dbs/local/types';
import type { IAccountSelectorSelectedAccount } from '@onekeyhq/kit-bg/src/dbs/simple/entity/SimpleDbEntityAccountSelector';
import type {
  IAccountDeriveInfo,
  IAccountDeriveInfoItems,
  IAccountDeriveTypes,
  IVaultSettings,
} from '@onekeyhq/kit-bg/src/vaults/types';
import { checkIsDefined } from '@onekeyhq/shared/src/utils/assertUtils';
import type {
  EAccountSelectorSceneName,
  IServerNetwork,
} from '@onekeyhq/shared/types';
import type { INetworkAccount } from '@onekeyhq/shared/types/account';

import { createJotaiContext } from '../../utils/createJotaiContext';

// TODO save sceneName and sceneUrl to atom, so actions can get it
export interface IAccountSelectorContextData {
  sceneName: EAccountSelectorSceneName;
  sceneUrl?: string;
}
export type IAccountSelectorRouteParams = IAccountSelectorContextData & {
  num: number;
};
const {
  Provider: AccountSelectorJotaiProvider,
  useContextData: useAccountSelectorContextData,
  contextAtom,
  contextAtomMethod,
} = createJotaiContext<IAccountSelectorContextData>();

export const {
  atom: accountSelectorContextDataAtom,
  use: useAccountSelectorContextDataAtom,
} = contextAtom<IAccountSelectorContextData | undefined>(undefined);

export const defaultSelectedAccount: () => IAccountSelectorSelectedAccount =
  () => ({
    walletId: undefined,
    indexedAccountId: undefined,
    othersWalletAccountId: undefined,
    networkId: undefined,
    deriveType: 'default',
    focusedWallet: undefined,
  });
export type ISelectedAccountsAtomMap = Partial<{
  [num: number]: IAccountSelectorSelectedAccount;
}>;
export const { atom: selectedAccountsAtom, use: useSelectedAccountsAtom } =
  contextAtom<ISelectedAccountsAtomMap>({
    0: defaultSelectedAccount(),
  });

// const atomInstance = selectedAccountsAtom();
// const oldWrite = atomInstance.write;
// atomInstance.write = (get, set, update) => {
//   console.log('AccountSelectorAtomChanged selectedAccountsAtom write');
//   oldWrite.call(atomInstance, get, set, update);
// };

export function useSelectedAccount({
  num,
  debugName,
}: {
  num: number;
  debugName?: string;
}): {
  selectedAccount: IAccountSelectorSelectedAccount;
  isSelectedAccountDefaultValue: boolean;
} {
  checkIsDefined(num);
  const [selectedAccounts] = useSelectedAccountsAtom();
  const selectedAccountOfNum = useMemo(
    () => selectedAccounts[num],
    [num, selectedAccounts],
  );

  if (debugName === 'HomePage') {
    console.log(
      'AccountSelectorAtomChanged useSelectedAccount selectedAccountOfNum: ',
      selectedAccountOfNum,
    );
  }
  return useMemo(() => {
    let selectedAccount = selectedAccountOfNum;
    let isSelectedAccountDefaultValue = false;
    if (!selectedAccount) {
      selectedAccount = defaultSelectedAccount();
      isSelectedAccountDefaultValue = true;
    }
    return {
      selectedAccount,
      isSelectedAccountDefaultValue,
    };
  }, [selectedAccountOfNum]);
}

export const {
  atom: accountSelectorEditModeAtom,
  use: useAccountSelectorEditModeAtom,
} = contextAtom<boolean>(false);

export const {
  atom: accountSelectorStorageReadyAtom,
  use: useAccountSelectorStorageReadyAtom,
} = contextAtom<boolean>(false);

export type IAccountSelectorAvailableNetworks = {
  networkIds?: string[];
  defaultNetworkId?: string;
};
export type IAccountSelectorAvailableNetworksMap = Partial<{
  [num: number]: IAccountSelectorAvailableNetworks;
}>;
export const {
  atom: accountSelectorAvailableNetworksAtom,
  use: useAccountSelectorAvailableNetworksAtom,
} = contextAtom<IAccountSelectorAvailableNetworksMap>({
  0: {},
});
export type IAccountSelectorUpdateMeta = {
  eventEmitDisabled: boolean;
};
export const {
  atom: accountSelectorUpdateMetaAtom,
  use: useAccountSelectorUpdateMetaAtom,
} = contextAtom<
  Partial<{
    [num: number]: IAccountSelectorUpdateMeta;
  }>
>({});

export type IAccountSelectorSyncLoadingMeta = {
  isLoading: boolean;
};
export const {
  atom: accountSelectorSyncLoadingAtom,
  use: useAccountSelectorSyncLoadingAtom,
} = contextAtom<
  Partial<{
    [num: number]: IAccountSelectorSyncLoadingMeta;
  }>
>({});

export interface IAccountSelectorActiveAccountInfo {
  ready: boolean;
  isOthersWallet?: boolean;
  account: INetworkAccount | undefined;
  indexedAccount: IDBIndexedAccount | undefined;
  dbAccount: IDBAccount | undefined;
  accountName: string;
  wallet: IDBWallet | undefined;
  device: IDBDevice | undefined;
  network: IServerNetwork | undefined;
  vaultSettings: IVaultSettings | undefined;
  deriveType: IAccountDeriveTypes;
  deriveInfo?: IAccountDeriveInfo | undefined;
  deriveInfoItems: IAccountDeriveInfoItems[];
  canCreateAddress?: boolean;
  isNetworkNotMatched?: boolean;
  allNetworkDbAccounts?: IDBAccount[] | undefined;
}
export const defaultActiveAccountInfo: () => IAccountSelectorActiveAccountInfo =
  () => ({
    account: undefined,
    indexedAccount: undefined,
    dbAccount: undefined,
    accountName: '',
    wallet: undefined,
    device: undefined,
    network: undefined,
    vaultSettings: undefined,
    deriveType: 'default',
    deriveInfoItems: [],
    ready: false,
  });
export const { atom: activeAccountsAtom, use: useActiveAccountsAtom } =
  contextAtom<Partial<{ [num: number]: IAccountSelectorActiveAccountInfo }>>({
    0: defaultActiveAccountInfo(),
  });

export function useActiveAccount({ num }: { num: number }): {
  activeAccount: IAccountSelectorActiveAccountInfo;
} {
  // TODO why add this deps for cosmos account model?
  // const [selectedAccounts] = useSelectedAccountsAtom();
  // noopObject(selectedAccounts);

  const [accounts] = useActiveAccountsAtom();

  return useMemo(() => {
    const accountInfo = accounts[num];
    const activeAccount = accountInfo || defaultActiveAccountInfo();
    return {
      activeAccount,
    };
  }, [accounts, num]);
}

export function useAccountSelectorSceneInfo() {
  const { config } = useAccountSelectorContextData();
  if (!config) {
    throw new Error(
      'useAccountSelectorSceneInfo ERROR: context config not found',
    );
  }
  return config;
}

export {
  AccountSelectorJotaiProvider,
  contextAtomMethod,
  useAccountSelectorContextData,
};
