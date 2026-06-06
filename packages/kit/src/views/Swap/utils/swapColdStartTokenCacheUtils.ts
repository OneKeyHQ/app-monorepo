import type { IAccountSelectorSelectedAccount } from '@onekeyhq/kit-bg/src/dbs/simple/entity/SimpleDbEntityAccountSelector';
import {
  buildSwapSelectedTokensColdStartAccountKey,
  buildSwapSelectedTokensColdStartContext,
  isSwapSelectedTokensColdStartContextMatched,
} from '@onekeyhq/shared/src/utils/swapColdStartCacheSnapshotUtils';
import type { ISwapSelectedTokensColdStartContext } from '@onekeyhq/shared/src/utils/swapColdStartCacheSnapshotUtils';
import type { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

export {
  buildSwapSelectedTokensColdStartAccountKey,
  buildSwapSelectedTokensColdStartContext,
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
  const walletId = selectedAccount?.walletId ?? '';
  const accountId =
    selectedAccount?.indexedAccountId ??
    selectedAccount?.othersWalletAccountId ??
    '';
  const deriveType = selectedAccount?.deriveType ?? '';

  if (!walletId && !accountId) {
    return undefined;
  }

  return [walletId, accountId, deriveType].join('|');
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
  if (
    eventPayload.sceneName !== SWAP_COLD_START_HOME_SCENE_NAME ||
    eventPayload.num !== 0
  ) {
    return false;
  }

  const matched =
    isSwapSelectedTokensColdStartContextMatchedWithSelectedAccount({
      cachedContext,
      selectedAccount: eventPayload.selectedAccount,
    });

  return matched === false;
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
