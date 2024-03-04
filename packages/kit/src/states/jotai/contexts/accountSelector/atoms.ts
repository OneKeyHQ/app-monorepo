import { useMemo } from 'react';

import type {
  IDBIndexedAccount,
  IDBWallet,
} from '@onekeyhq/kit-bg/src/dbs/local/types';
import type { IAccountSelectorSelectedAccount } from '@onekeyhq/kit-bg/src/dbs/simple/entity/SimpleDbEntityAccountSelector';
import type {
  IAccountDeriveInfo,
  IAccountDeriveInfoItems,
  IAccountDeriveTypes,
} from '@onekeyhq/kit-bg/src/vaults/types';
import { checkIsDefined } from '@onekeyhq/shared/src/utils/assertUtils';
import { noopObject } from '@onekeyhq/shared/src/utils/miscUtils';
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
export const { atom: selectedAccountsAtom, use: useSelectedAccountsAtom } =
  contextAtom<Partial<{ [num: number]: IAccountSelectorSelectedAccount }>>({
    0: defaultSelectedAccount(),
  });
export function useSelectedAccount({ num }: { num: number }): {
  selectedAccount: IAccountSelectorSelectedAccount;
  isSelectedAccountDefaultValue: boolean;
} {
  checkIsDefined(num);
  const [selectedAccounts] = useSelectedAccountsAtom();
  return useMemo(() => {
    let selectedAccount = selectedAccounts[num];
    let isSelectedAccountDefaultValue = false;
    if (!selectedAccount) {
      selectedAccount = defaultSelectedAccount();
      isSelectedAccountDefaultValue = true;
    }
    return {
      selectedAccount,
      isSelectedAccountDefaultValue,
    };
  }, [num, selectedAccounts]);
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

export interface IAccountSelectorActiveAccountInfo {
  ready: boolean;
  isOthersWallet?: boolean;
  account: INetworkAccount | undefined;
  indexedAccount: IDBIndexedAccount | undefined;
  accountName: string;
  wallet: IDBWallet | undefined;
  network: IServerNetwork | undefined;
  deriveType: IAccountDeriveTypes;
  deriveInfo?: IAccountDeriveInfo | undefined;
  deriveInfoItems: IAccountDeriveInfoItems[];
}
export const defaultActiveAccountInfo: () => IAccountSelectorActiveAccountInfo =
  () => ({
    account: undefined,
    indexedAccount: undefined,
    accountName: '',
    wallet: undefined,
    network: undefined,
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
  const [selectedAccounts] = useSelectedAccountsAtom();
  noopObject(selectedAccounts);
  const [accounts] = useActiveAccountsAtom();
  const accountInfo = accounts[num];
  const activeAccount = accountInfo || defaultActiveAccountInfo();
  return {
    activeAccount,
  };
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
