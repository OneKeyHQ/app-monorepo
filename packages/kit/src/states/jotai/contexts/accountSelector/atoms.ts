import { useMemo } from 'react';

import { selectAtom } from 'jotai/utils';

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
import { CONTEXT_ATOM_COLD_START_CACHE_KEYS } from '@onekeyhq/shared/src/consts/jotaiConsts';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
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
  contextAtomComputed,
  contextAtomMethod,
} = createJotaiContext<IAccountSelectorContextData>();

export const {
  atom: accountSelectorContextDataAtom,
  use: useAccountSelectorContextDataAtom,
} = contextAtom<IAccountSelectorContextData | undefined>(undefined);

// Stable scope identity for request bookkeeping that must stay per-store.
// accountSelectorContextDataAtom is only populated once AccountSelectorEffects
// mounts, so anything keyed on sceneName alone collapses into one shared bucket
// during that window and lets unrelated selectors cancel each other. Assigned on
// first use (from the scene identity when it is already known) and then never
// reassigned, so a store keeps one bucket across the mount boundary.
export const {
  atom: accountSelectorStoreScopeIdAtom,
  use: useAccountSelectorStoreScopeIdAtom,
} = contextAtom<string>('');

export const defaultSelectedAccount: () => IAccountSelectorSelectedAccount =
  () => ({
    walletId: undefined,
    indexedAccountId: undefined,
    othersWalletAccountId: undefined,
    networkId: undefined,
    deriveType: undefined,
    focusedWallet: undefined,
  });
export type ISelectedAccountsAtomMap = Partial<{
  [num: number]: IAccountSelectorSelectedAccount;
}>;
export const { atom: selectedAccountsAtom, use: useSelectedAccountsAtom } =
  contextAtom<ISelectedAccountsAtomMap>(
    {
      0: defaultSelectedAccount(),
    },
    {
      coldStartCache: true,
      coldStartCacheKey:
        CONTEXT_ATOM_COLD_START_CACHE_KEYS.selectedAccountsAtom,
    },
  );

const selectedAccountByNumAtomCache = new Map<
  number,
  ReturnType<
    typeof contextAtomComputed<IAccountSelectorSelectedAccount | undefined>
  >
>();

function getOrCreateSelectedAccountByNumAtom(num: number) {
  let entry = selectedAccountByNumAtomCache.get(num);
  if (!entry) {
    const selectedAtom = selectAtom(
      selectedAccountsAtom(),
      (selectedAccounts) => selectedAccounts[num],
    );
    entry = contextAtomComputed((get) => get(selectedAtom));
    selectedAccountByNumAtomCache.set(num, entry);
  }
  return entry;
}

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
  const [selectedAccountOfNum] = getOrCreateSelectedAccountByNumAtom(num).use();

  if (debugName === 'HomePage') {
    // console.log(
    //   'AccountSelectorAtomChanged useSelectedAccount selectedAccountOfNum: ',
    //   selectedAccountOfNum,
    // );
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
} = contextAtom<boolean>(false, {
  // Cached across cold starts so the selector can render from the last snapshot
  // before this launch finishes reading storage.
  coldStartCache: true,
  coldStartCacheKey:
    CONTEXT_ATOM_COLD_START_CACHE_KEYS.accountSelectorStorageReadyAtom,
});

// Process-local init signal. Do not replace this with storageReady: warm starts
// can restore storageReady=true before the current launch has read storage.
export const {
  atom: accountSelectorStorageInitDoneAtom,
  use: useAccountSelectorStorageInitDoneAtom,
} = contextAtom<boolean>(false);

export const {
  atom: accountSelectorActiveAccountInitDoneAtom,
  use: useAccountSelectorActiveAccountInitDoneAtom,
} = contextAtom<Partial<{ [num: number]: boolean }>>({});

const activeAccountInitDoneByNumAtomCache = new Map<
  number,
  ReturnType<typeof contextAtomComputed<boolean>>
>();

function getOrCreateActiveAccountInitDoneByNumAtom(num: number) {
  let entry = activeAccountInitDoneByNumAtomCache.get(num);
  if (!entry) {
    const selectedAtom = selectAtom(
      accountSelectorActiveAccountInitDoneAtom(),
      (initDone) => Boolean(initDone[num]),
    );
    entry = contextAtomComputed((get) => get(selectedAtom));
    activeAccountInitDoneByNumAtomCache.set(num, entry);
  }
  return entry;
}

export function useIsAccountSelectorActiveAccountInitDone(
  num: number,
): boolean {
  const [initDone] = getOrCreateActiveAccountInitDoneByNumAtom(num).use();
  return initDone;
}

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

const availableNetworksByNumAtomCache = new Map<
  number,
  ReturnType<
    typeof contextAtomComputed<IAccountSelectorAvailableNetworks | undefined>
  >
>();

function getOrCreateAvailableNetworksByNumAtom(num: number) {
  let entry = availableNetworksByNumAtomCache.get(num);
  if (!entry) {
    const selectedAtom = selectAtom(
      accountSelectorAvailableNetworksAtom(),
      (availableNetworks) => availableNetworks[num],
    );
    entry = contextAtomComputed((get) => get(selectedAtom));
    availableNetworksByNumAtomCache.set(num, entry);
  }
  return entry;
}

export function useAccountSelectorAvailableNetworksByNum(num: number) {
  const [availableNetworks] = getOrCreateAvailableNetworksByNumAtom(num).use();
  return availableNetworks;
}
export type IAccountSelectorUpdateMeta = {
  eventEmitDisabled: boolean;
  // The selection's committed revision. Undefined means the slot holds a value
  // that was applied from an unversioned source (cold-start storage apply, an
  // event that carried no revision) and therefore claims no ordering: any
  // event with a real revision may replace it, and the next local commit mints
  // a fresh revision. Never backfill it with a receive time - that would make
  // the unversioned value outrank every revision emitted before "now".
  updatedAt?: number;
};
export const {
  atom: accountSelectorUpdateMetaAtom,
  use: useAccountSelectorUpdateMetaAtom,
} = contextAtom<
  Partial<{
    [num: number]: IAccountSelectorUpdateMeta;
  }>
>(
  {},
  {
    coldStartCache: true,
    coldStartCacheKey:
      CONTEXT_ATOM_COLD_START_CACHE_KEYS.accountSelectorUpdateMetaAtom,
  },
);

const updateMetaByNumAtomCache = new Map<
  number,
  ReturnType<typeof contextAtomComputed<IAccountSelectorUpdateMeta | undefined>>
>();

function getOrCreateUpdateMetaByNumAtom(num: number) {
  let entry = updateMetaByNumAtomCache.get(num);
  if (!entry) {
    const selectedAtom = selectAtom(
      accountSelectorUpdateMetaAtom(),
      (updateMeta) => updateMeta[num],
    );
    entry = contextAtomComputed((get) => get(selectedAtom));
    updateMetaByNumAtomCache.set(num, entry);
  }
  return entry;
}

export function useAccountSelectorUpdateMetaByNum(num: number) {
  const [updateMeta] = getOrCreateUpdateMetaByNumAtom(num).use();
  return updateMeta;
}

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

const syncLoadingByNumAtomCache = new Map<
  number,
  ReturnType<typeof contextAtomComputed<boolean>>
>();

function getOrCreateSyncLoadingByNumAtom(num: number) {
  let entry = syncLoadingByNumAtomCache.get(num);
  if (!entry) {
    const selectedAtom = selectAtom(
      accountSelectorSyncLoadingAtom(),
      (syncLoading) => Boolean(syncLoading[num]?.isLoading),
    );
    entry = contextAtomComputed((get) => get(selectedAtom));
    syncLoadingByNumAtomCache.set(num, entry);
  }
  return entry;
}

export function useIsAccountSelectorSyncLoading(num: number): boolean {
  const [syncLoading] = getOrCreateSyncLoadingByNumAtom(num).use();
  return syncLoading;
}

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
  deriveType: IAccountDeriveTypes | undefined;
  deriveInfo?: IAccountDeriveInfo | undefined;
  deriveInfoItems: IAccountDeriveInfoItems[];
  canCreateAddress?: boolean;
  isNetworkNotMatched?: boolean;
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
    deriveType: undefined,
    deriveInfoItems: [],
    ready: false,
  });
export const { atom: activeAccountsAtom, use: useActiveAccountsAtom } =
  contextAtom<Partial<{ [num: number]: IAccountSelectorActiveAccountInfo }>>(
    {
      0: defaultActiveAccountInfo(),
    },
    {
      coldStartCache: true,
      coldStartCacheKey: CONTEXT_ATOM_COLD_START_CACHE_KEYS.activeAccountsAtom,
    },
  );

const activeAccountByNumAtomCache = new Map<
  number,
  ReturnType<
    typeof contextAtomComputed<IAccountSelectorActiveAccountInfo | undefined>
  >
>();

function getOrCreateActiveAccountByNumAtom(num: number) {
  let entry = activeAccountByNumAtomCache.get(num);
  if (!entry) {
    const selectedAtom = selectAtom(
      activeAccountsAtom(),
      (activeAccounts) => activeAccounts[num],
    );
    entry = contextAtomComputed((get) => get(selectedAtom));
    activeAccountByNumAtomCache.set(num, entry);
  }
  return entry;
}

export function useActiveAccount({ num }: { num: number }): {
  activeAccount: IAccountSelectorActiveAccountInfo;
} {
  // TODO why add this deps for cosmos account model?
  // const [selectedAccounts] = useSelectedAccountsAtom();
  // noopObject(selectedAccounts);

  const [accountInfo] = getOrCreateActiveAccountByNumAtom(num).use();

  return useMemo(() => {
    const activeAccount = accountInfo || defaultActiveAccountInfo();
    return {
      activeAccount,
    };
  }, [accountInfo]);
}

export function useAccountSelectorSceneInfo() {
  const { config } = useAccountSelectorContextData();
  if (!config) {
    throw new OneKeyLocalError(
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
