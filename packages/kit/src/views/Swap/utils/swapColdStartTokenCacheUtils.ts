import type { IAccountSelectorSelectedAccount } from '@onekeyhq/kit-bg/src/dbs/simple/entity/SimpleDbEntityAccountSelector';
import {
  buildSwapSelectedTokensColdStartAccountKey,
  buildSwapSelectedTokensColdStartContext,
  isSwapColdStartAllNetworkContextNetworkId,
  isSwapSelectedTokensColdStartContextMatched,
} from '@onekeyhq/shared/src/utils/swapColdStartCacheSnapshotUtils';
import type { ISwapSelectedTokensColdStartContext } from '@onekeyhq/shared/src/utils/swapColdStartCacheSnapshotUtils';
import type { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

export {
  buildSwapSelectedTokensColdStartAccountKey,
  buildSwapSelectedTokensColdStartContext,
  isSwapColdStartAllNetworkContextNetworkId,
  isSwapSelectedTokensColdStartContextMatched,
};

export const SWAP_COLD_START_HOME_SCENE_NAME =
  'home' as EAccountSelectorSceneName;

export function buildSwapSelectedTokensColdStartAccountKeyFromSelectedAccount(
  selectedAccount?: Pick<
    IAccountSelectorSelectedAccount,
    'walletId' | 'indexedAccountId' | 'othersWalletAccountId' | 'deriveType'
  >,
) {
  // Delegate to the single shared key builder so the persisted selected-account
  // key always matches the runtime active-account key. othersWalletAccountId is a
  // DB account id, so it maps to dbAccount.id (which the shared builder resolves
  // before account.id).
  return buildSwapSelectedTokensColdStartAccountKey({
    wallet: selectedAccount?.walletId
      ? { id: selectedAccount.walletId }
      : undefined,
    indexedAccount: selectedAccount?.indexedAccountId
      ? { id: selectedAccount.indexedAccountId }
      : undefined,
    dbAccount: selectedAccount?.othersWalletAccountId
      ? { id: selectedAccount.othersWalletAccountId }
      : undefined,
    deriveType: selectedAccount?.deriveType,
  });
}

export function isSwapSelectedTokensColdStartContextMatchedWithSelectedAccount({
  cachedContext,
  selectedAccount,
}: {
  cachedContext?: ISwapSelectedTokensColdStartContext;
  selectedAccount?: IAccountSelectorSelectedAccount;
}) {
  if (!cachedContext || !selectedAccount?.networkId) {
    return undefined;
  }

  const accountKey =
    buildSwapSelectedTokensColdStartAccountKeyFromSelectedAccount(
      selectedAccount,
    );
  if (!accountKey) {
    return undefined;
  }

  return (
    cachedContext.accountKey === accountKey &&
    cachedContext.networkId === selectedAccount.networkId
  );
}

function isHomeMainAccountUpdate({
  eventPayload,
}: {
  eventPayload: {
    sceneName: EAccountSelectorSceneName;
    num: number;
  };
}) {
  return (
    eventPayload.sceneName === SWAP_COLD_START_HOME_SCENE_NAME &&
    eventPayload.num === 0
  );
}

export function shouldClearSwapSelectedTokensOnHomeAccountUpdate({
  cachedContext,
  eventPayload,
}: {
  cachedContext?: ISwapSelectedTokensColdStartContext;
  eventPayload: {
    selectedAccount?: IAccountSelectorSelectedAccount;
    sceneName: EAccountSelectorSceneName;
    num: number;
  };
}) {
  if (!isHomeMainAccountUpdate({ eventPayload })) {
    return false;
  }

  // No cached context means there are no restored cold-start tokens to protect.
  if (!cachedContext) {
    return false;
  }

  // Home account was cleared/reset (disconnect, wallet removed, back to a default
  // empty account): the new selected account has no network or no resolvable
  // account key, so the restored tokens no longer belong to any active account
  // and must be dropped. Treat this as an explicit mismatch rather than letting
  // the matcher return undefined (which would leave stale tokens behind).
  const { selectedAccount } = eventPayload;
  const accountKey =
    buildSwapSelectedTokensColdStartAccountKeyFromSelectedAccount(
      selectedAccount,
    );
  if (!selectedAccount?.networkId || !accountKey) {
    return true;
  }

  return (
    isSwapSelectedTokensColdStartContextMatchedWithSelectedAccount({
      cachedContext,
      selectedAccount,
    }) === false
  );
}

function isSelectedAccountMatched(
  accountA?: IAccountSelectorSelectedAccount,
  accountB?: IAccountSelectorSelectedAccount,
) {
  return (
    accountA?.walletId === accountB?.walletId &&
    accountA?.indexedAccountId === accountB?.indexedAccountId &&
    accountA?.othersWalletAccountId === accountB?.othersWalletAccountId &&
    accountA?.networkId === accountB?.networkId &&
    accountA?.deriveType === accountB?.deriveType
  );
}

export function shouldSyncSwapSelectedAccountOnHomeAccountUpdate({
  cachedContext,
  eventPayload,
  hasSelectedTokens,
  swapActiveNetworkId,
  swapSelectedAccount,
}: {
  cachedContext?: ISwapSelectedTokensColdStartContext;
  eventPayload: {
    selectedAccount?: IAccountSelectorSelectedAccount;
    sceneName: EAccountSelectorSceneName;
    num: number;
  };
  hasSelectedTokens: boolean;
  swapActiveNetworkId?: string;
  swapSelectedAccount?: IAccountSelectorSelectedAccount;
}) {
  if (!isHomeMainAccountUpdate({ eventPayload })) {
    return false;
  }

  if (!eventPayload.selectedAccount?.networkId) {
    return false;
  }

  if (hasSelectedTokens) {
    return (
      isSwapSelectedTokensColdStartContextMatchedWithSelectedAccount({
        cachedContext,
        selectedAccount: eventPayload.selectedAccount,
      }) !== true
    );
  }

  if (
    swapActiveNetworkId &&
    swapActiveNetworkId !== eventPayload.selectedAccount.networkId
  ) {
    return true;
  }

  return !isSelectedAccountMatched(
    eventPayload.selectedAccount,
    swapSelectedAccount,
  );
}

export function buildSwapSelectedAccountSyncedFromHome({
  homeSelectedAccount,
  swapSelectedAccount,
}: {
  homeSelectedAccount: IAccountSelectorSelectedAccount;
  swapSelectedAccount: IAccountSelectorSelectedAccount;
}): IAccountSelectorSelectedAccount {
  return {
    ...swapSelectedAccount,
    walletId: homeSelectedAccount.walletId,
    indexedAccountId: homeSelectedAccount.indexedAccountId,
    othersWalletAccountId: homeSelectedAccount.othersWalletAccountId,
    focusedWallet: homeSelectedAccount.focusedWallet,
    networkId: homeSelectedAccount.networkId,
    deriveType:
      homeSelectedAccount.deriveType ?? swapSelectedAccount.deriveType,
  };
}
