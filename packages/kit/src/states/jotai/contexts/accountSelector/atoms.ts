import type {
  IDBAccount,
  IDBIndexedAccount,
  IDBWallet,
} from '@onekeyhq/kit-bg/src/dbs/local/types';
import type { IAccountSelectorSelectedAccount } from '@onekeyhq/kit-bg/src/dbs/simple/entity/SimpleDbEntityAccountSelector';
import type { IAccountDeriveTypes } from '@onekeyhq/kit-bg/src/vaults/types';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { checkIsDefined } from '@onekeyhq/shared/src/utils/assertUtils';
import type {
  EAccountSelectorSceneName,
  IServerNetwork,
} from '@onekeyhq/shared/types';

import { createJotaiContext } from '../../utils/createJotaiContext';

export interface IAccountSelectorContextData {
  sceneName: EAccountSelectorSceneName;
  sceneUrl?: string;
}
const {
  Provider: AccountSelectorJotaiProvider,
  useContextData: useAccountSelectorContextData,
  contextAtom,
  contextAtomMethod,
} = createJotaiContext<IAccountSelectorContextData>();

export const defaultSelectedAccount: IAccountSelectorSelectedAccount = {
  walletId: undefined,
  indexedAccountId: undefined,
  accountId: undefined,
  networkId: undefined,
  deriveType: 'default',
  focusedWallet: undefined,
};
export const { atom: selectedAccountsAtom, use: useSelectedAccountsAtom } =
  contextAtom<Partial<{ [num: number]: IAccountSelectorSelectedAccount }>>({
    0: defaultSelectedAccount,
  });
export function useSelectedAccount({ num }: { num: number }): {
  selectedAccount: IAccountSelectorSelectedAccount;
  isSelectedAccountDefaultValue: boolean;
} {
  checkIsDefined(num);
  const [selectedAccounts] = useSelectedAccountsAtom();
  let selectedAccount = selectedAccounts[num];
  let isSelectedAccountDefaultValue = false;
  if (!selectedAccount) {
    selectedAccount = defaultSelectedAccount;
    isSelectedAccountDefaultValue = true;
  }
  return {
    selectedAccount,
    isSelectedAccountDefaultValue,
  };
}

export const {
  atom: accountSelectorStorageReadyAtom,
  use: useAccountSelectorStorageReadyAtom,
} = contextAtom<boolean>(false);

export interface IAccountSelectorActiveAccountInfo {
  account: IDBAccount | undefined;
  indexedAccount: IDBIndexedAccount | undefined;
  wallet: IDBWallet | undefined;
  network: IServerNetwork | undefined;
  deriveType: IAccountDeriveTypes; // TODO move to jotai global
  // deriveInfo
  // indexedAccount
}
const defaultActiveAccountInfo: IAccountSelectorActiveAccountInfo = {
  account: undefined,
  indexedAccount: undefined,
  wallet: undefined,
  network: undefined,
  deriveType: 'default',
};
export const { atom: activeAccountsAtom, use: useActiveAccountsAtom } =
  contextAtom<Partial<{ [num: number]: IAccountSelectorActiveAccountInfo }>>({
    0: defaultActiveAccountInfo,
  });

export function useActiveAccount({ num }: { num: number }): {
  activeAccount: IAccountSelectorActiveAccountInfo;
  activeAccountName: string;
} {
  const [accounts] = useActiveAccountsAtom();
  const accountInfo = accounts[num];
  const activeAccount = accountInfo || defaultActiveAccountInfo;
  let activeAccountName = activeAccount.account?.name || '';
  if (accountUtils.isHdWallet({ walletId: activeAccount.wallet?.id || '' })) {
    activeAccountName = activeAccount.indexedAccount?.name || '';
  }
  return {
    activeAccount: accountInfo || defaultActiveAccountInfo,
    activeAccountName,
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
