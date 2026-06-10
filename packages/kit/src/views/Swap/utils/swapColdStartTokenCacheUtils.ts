import type { IAccountSelectorSelectedAccount } from '@onekeyhq/kit-bg/src/dbs/simple/entity/SimpleDbEntityAccountSelector';
import {
  buildSwapSelectedTokensColdStartAccountKey,
  buildSwapSelectedTokensColdStartContext,
  isSwapColdStartAllNetworkContextNetworkId,
  isSwapSelectedTokensColdStartContextMatched,
} from '@onekeyhq/shared/src/utils/swapColdStartCacheSnapshotUtils';
import type { ISwapSelectedTokensColdStartContext } from '@onekeyhq/shared/src/utils/swapColdStartCacheSnapshotUtils';
import { equalTokenNoCaseSensitive } from '@onekeyhq/shared/src/utils/tokenUtils';
import type { EAccountSelectorSceneName } from '@onekeyhq/shared/types';
import {
  swapBridgeDefaultTokenConfigs,
  swapBridgeDefaultTokenExtraConfigs,
  swapDefaultSetTokens,
} from '@onekeyhq/shared/types/swap/SwapProvider.constants';
import type {
  ISwapNetwork,
  ISwapToken,
} from '@onekeyhq/shared/types/swap/types';
import { ESwapTabSwitchType } from '@onekeyhq/shared/types/swap/types';

export {
  buildSwapSelectedTokensColdStartAccountKey,
  buildSwapSelectedTokensColdStartContext,
  isSwapColdStartAllNetworkContextNetworkId,
  isSwapSelectedTokensColdStartContextMatched,
};

export const SWAP_COLD_START_HOME_SCENE_NAME =
  'home' as EAccountSelectorSceneName;

type ISwapSelectedAccountKeySource = {
  walletId?: string;
  indexedAccountId?: string;
  othersWalletAccountId?: string;
  deriveType?: string;
};

type ISwapHomeSelectedAccountForDefaults = ISwapSelectedAccountKeySource & {
  networkId?: string;
};

export function buildSwapSelectedTokensColdStartAccountKeyFromSelectedAccount(
  selectedAccount?: ISwapSelectedAccountKeySource,
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

function buildSwapSelectedTokensColdStartOwnerKeyFromSelectedAccount(
  selectedAccount?: ISwapSelectedAccountKeySource,
) {
  const walletId = selectedAccount?.walletId ?? '';
  const accountId =
    selectedAccount?.indexedAccountId ??
    selectedAccount?.othersWalletAccountId ??
    '';

  if (!walletId && !accountId) {
    return undefined;
  }

  return [walletId, accountId].join('|');
}

function buildSwapSelectedTokensColdStartOwnerKeyFromContext(
  cachedContext?: ISwapSelectedTokensColdStartContext,
) {
  const [walletId = '', accountId = ''] =
    cachedContext?.accountKey.split('|') ?? [];

  if (!walletId && !accountId) {
    return undefined;
  }

  return [walletId, accountId].join('|');
}

function isSelectedAccountOwnerMatchedIgnoringDeriveType(
  accountA?: IAccountSelectorSelectedAccount,
  accountB?: IAccountSelectorSelectedAccount,
) {
  const accountKeyA =
    buildSwapSelectedTokensColdStartOwnerKeyFromSelectedAccount(accountA);
  const accountKeyB =
    buildSwapSelectedTokensColdStartOwnerKeyFromSelectedAccount(accountB);
  return Boolean(accountKeyA && accountKeyA === accountKeyB);
}

function isSwapSelectedTokensColdStartOwnerMatchedWithSelectedAccountIgnoringDeriveType({
  cachedContext,
  selectedAccount,
}: {
  cachedContext?: ISwapSelectedTokensColdStartContext;
  selectedAccount?: IAccountSelectorSelectedAccount;
}) {
  const cachedOwnerKey =
    buildSwapSelectedTokensColdStartOwnerKeyFromContext(cachedContext);
  const selectedOwnerKey =
    buildSwapSelectedTokensColdStartOwnerKeyFromSelectedAccount(
      selectedAccount,
    );
  return Boolean(
    cachedOwnerKey && selectedOwnerKey && cachedOwnerKey === selectedOwnerKey,
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

export function shouldHandleSwapColdStartHomeAccountUpdate({
  cachedContext,
  eventPayload,
  hasSelectedTokens,
  initialSelectedTokensSynced,
}: {
  cachedContext?: ISwapSelectedTokensColdStartContext;
  eventPayload: {
    selectedAccount?: IAccountSelectorSelectedAccount;
    sceneName: EAccountSelectorSceneName;
    num: number;
  };
  hasSelectedTokens?: boolean;
  initialSelectedTokensSynced: boolean;
}) {
  if (initialSelectedTokensSynced) {
    return false;
  }

  if (
    hasSelectedTokens &&
    isSwapSelectedTokensColdStartOwnerMatchedWithSelectedAccountIgnoringDeriveType(
      {
        cachedContext,
        selectedAccount: eventPayload.selectedAccount,
      },
    )
  ) {
    return false;
  }

  return shouldClearSwapSelectedTokensOnHomeAccountUpdate({
    cachedContext,
    eventPayload,
  });
}

function getDefaultSelectedTokensSwapType({
  fromToken,
  toToken,
}: {
  fromToken?: ISwapToken;
  toToken?: ISwapToken;
}) {
  if (
    fromToken?.networkId &&
    toToken?.networkId &&
    fromToken.networkId !== toToken.networkId
  ) {
    return ESwapTabSwitchType.BRIDGE;
  }

  return ESwapTabSwitchType.SWAP;
}

function getBridgeDefaultToTokenForFromToken(fromToken?: ISwapToken) {
  if (!fromToken) {
    return undefined;
  }

  let defaultToToken: ISwapToken | undefined;
  swapBridgeDefaultTokenConfigs.some((config) => {
    const matchedToken = config.fromTokens.find((token) =>
      equalTokenNoCaseSensitive({
        token1: {
          networkId: token.networkId,
          contractAddress: token.contractAddress,
        },
        token2: {
          networkId: fromToken.networkId,
          contractAddress: fromToken.contractAddress,
        },
      }),
    );
    if (matchedToken) {
      defaultToToken = config.toTokenDefaultMatch;
    }
    return Boolean(matchedToken);
  });

  if (defaultToToken) {
    return defaultToToken;
  }

  return fromToken.networkId ===
    swapBridgeDefaultTokenExtraConfigs.mainNetDefaultToTokenConfig.networkId
    ? swapBridgeDefaultTokenExtraConfigs.mainNetDefaultToTokenConfig
        .defaultToToken
    : swapBridgeDefaultTokenExtraConfigs.defaultToToken;
}

export function buildSwapDefaultSelectedTokensFromHomeAccount({
  homeSelectedAccount,
  swapType: preferredSwapType,
  now = Date.now(),
}: {
  homeSelectedAccount?: ISwapHomeSelectedAccountForDefaults;
  swapType?: ESwapTabSwitchType;
  now?: number;
}) {
  const accountKey =
    buildSwapSelectedTokensColdStartAccountKeyFromSelectedAccount(
      homeSelectedAccount,
    );
  const homeNetworkId = homeSelectedAccount?.networkId;
  if (!accountKey || !homeNetworkId) {
    return undefined;
  }

  const defaultTokens = swapDefaultSetTokens[homeNetworkId];
  const useLimitDefaults = preferredSwapType === ESwapTabSwitchType.LIMIT;
  const fromToken = useLimitDefaults
    ? defaultTokens?.limitFromToken
    : defaultTokens?.fromToken;
  const toToken = useLimitDefaults
    ? defaultTokens?.limitToToken
    : (defaultTokens?.toToken ??
      getBridgeDefaultToTokenForFromToken(fromToken));
  if (!fromToken && !toToken) {
    return undefined;
  }

  const swapType = useLimitDefaults
    ? ESwapTabSwitchType.LIMIT
    : getDefaultSelectedTokensSwapType({ fromToken, toToken });
  const contextNetworkId = getSwapSelectedTokensColdStartContextNetworkId({
    accountNetworkId: homeNetworkId,
    fromTokenNetworkId: fromToken?.networkId,
  });
  if (!contextNetworkId) {
    return undefined;
  }

  return {
    fromToken,
    toToken,
    context: {
      accountKey,
      networkId: contextNetworkId,
      swapType,
      updatedAt: now,
    },
    swapType,
  };
}

export function getSelectedTokensColdStartLimitSupport({
  swapType,
  fromToken,
  toToken,
  swapNetworks,
}: {
  swapType: ESwapTabSwitchType;
  fromToken?: ISwapToken;
  toToken?: ISwapToken;
  swapNetworks: ISwapNetwork[];
}) {
  if (swapType !== ESwapTabSwitchType.LIMIT) {
    return true;
  }

  const selectedTokenNetworkId = fromToken?.networkId ?? toToken?.networkId;
  if (!selectedTokenNetworkId) {
    return true;
  }

  if (!swapNetworks.length) {
    return undefined;
  }

  const selectedTokenNetwork = swapNetworks.find(
    (net) => net.networkId === selectedTokenNetworkId,
  );
  if (!selectedTokenNetwork) {
    return true;
  }

  return Boolean(selectedTokenNetwork?.supportLimit);
}

export function getSwapTokenSupportTypes({
  token,
  swapNetworks,
}: {
  token?: ISwapToken;
  swapNetworks: ISwapNetwork[];
}) {
  const supportNet = swapNetworks.find(
    (net) => net.networkId === token?.networkId,
  );
  const supportTypes: ESwapTabSwitchType[] = [];
  if (!supportNet) {
    return supportTypes;
  }

  if (supportNet.supportSingleSwap) {
    supportTypes.push(ESwapTabSwitchType.SWAP);
  }
  if (supportNet.supportCrossChainSwap) {
    supportTypes.push(ESwapTabSwitchType.BRIDGE);
  }
  if (supportNet.supportLimit) {
    supportTypes.push(ESwapTabSwitchType.LIMIT);
  }

  return supportTypes;
}

export function isSwapTokenSupportedBySwapType({
  token,
  swapNetworks,
  swapType,
}: {
  token?: ISwapToken;
  swapNetworks: ISwapNetwork[];
  swapType?: ESwapTabSwitchType;
}) {
  return Boolean(
    swapType &&
    getSwapTokenSupportTypes({ token, swapNetworks }).includes(swapType),
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

function isSelectedAccountOwnerMatched(
  accountA?: IAccountSelectorSelectedAccount,
  accountB?: IAccountSelectorSelectedAccount,
) {
  const accountKeyA =
    buildSwapSelectedTokensColdStartAccountKeyFromSelectedAccount(accountA);
  const accountKeyB =
    buildSwapSelectedTokensColdStartAccountKeyFromSelectedAccount(accountB);
  return Boolean(accountKeyA && accountKeyA === accountKeyB);
}

export function shouldClearSwapSelectedTokensBeforeHomeAccountSync({
  cachedContext,
  hasSelectedTokens,
  homeSelectedAccount,
  initialSelectedTokensSynced,
  swapSelectedAccount,
}: {
  cachedContext?: ISwapSelectedTokensColdStartContext;
  hasSelectedTokens: boolean;
  homeSelectedAccount?: IAccountSelectorSelectedAccount;
  initialSelectedTokensSynced?: boolean;
  swapSelectedAccount?: IAccountSelectorSelectedAccount;
}) {
  if (!hasSelectedTokens) {
    return false;
  }

  if (
    initialSelectedTokensSynced &&
    isSelectedAccountOwnerMatchedIgnoringDeriveType(
      homeSelectedAccount,
      swapSelectedAccount,
    )
  ) {
    return false;
  }

  const isMatched =
    isSwapSelectedTokensColdStartContextMatchedWithSelectedAccount({
      cachedContext,
      selectedAccount: homeSelectedAccount,
    });
  if (isMatched === true) {
    return false;
  }

  const isSameOwnerAllNetworksHome =
    isSwapColdStartAllNetworkContextNetworkId(homeSelectedAccount?.networkId) &&
    isSelectedAccountOwnerMatched(homeSelectedAccount, swapSelectedAccount);
  if (
    isSameOwnerAllNetworksHome &&
    (!cachedContext ||
      isSwapSelectedTokensColdStartContextMatchedWithSelectedAccount({
        cachedContext,
        selectedAccount: swapSelectedAccount,
      }) === true)
  ) {
    return false;
  }

  return true;
}

export function shouldSkipSwapDefaultSelectedTokenSync({
  hasImportParams,
  hasSelectedTokens,
  initialSelectedTokensSynced,
}: {
  hasImportParams: boolean;
  hasSelectedTokens: boolean;
  initialSelectedTokensSynced: boolean;
}) {
  return initialSelectedTokensSynced && !hasImportParams && hasSelectedTokens;
}

export function getSwapSelectedTokensColdStartContextNetworkId({
  accountNetworkId,
  fromTokenNetworkId,
}: {
  accountNetworkId?: string;
  fromTokenNetworkId?: string;
}) {
  if (
    accountNetworkId &&
    isSwapColdStartAllNetworkContextNetworkId(accountNetworkId)
  ) {
    return accountNetworkId;
  }

  return fromTokenNetworkId ?? accountNetworkId;
}

export function isSwapSelectedTokensColdStartContextValidForAccountNetworkSync({
  activeAccount,
  fromToken,
  selectedTokensColdStartContext,
  toToken,
}: {
  activeAccount?: Parameters<
    typeof buildSwapSelectedTokensColdStartContext
  >[0]['activeAccount'];
  fromToken?: ISwapToken;
  selectedTokensColdStartContext?: ISwapSelectedTokensColdStartContext;
  toToken?: ISwapToken;
}) {
  if (!fromToken && !toToken) {
    return true;
  }
  if (!selectedTokensColdStartContext) {
    return true;
  }

  const currentContext = buildSwapSelectedTokensColdStartContext({
    activeAccount,
    networkId: getSwapSelectedTokensColdStartContextNetworkId({
      accountNetworkId: activeAccount?.network?.id,
      fromTokenNetworkId: fromToken?.networkId,
    }),
  });
  if (!currentContext) {
    return false;
  }

  return isSwapSelectedTokensColdStartContextMatched({
    cachedContext: selectedTokensColdStartContext,
    currentContext,
  });
}

export function shouldSyncSwapSelectedAccountOnHomeAccountUpdate({
  cachedContext,
  eventPayload,
  hasSelectedTokens,
  initialSelectedTokensSynced,
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
  initialSelectedTokensSynced?: boolean;
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
    if (
      initialSelectedTokensSynced &&
      isSelectedAccountOwnerMatchedIgnoringDeriveType(
        eventPayload.selectedAccount,
        swapSelectedAccount,
      )
    ) {
      return false;
    }

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
