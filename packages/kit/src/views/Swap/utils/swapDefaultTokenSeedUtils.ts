import type { IAccountSelectorSelectedAccount } from '@onekeyhq/kit-bg/src/dbs/simple/entity/SimpleDbEntityAccountSelector';
import type { ISwapSelectedTokensColdStartContext } from '@onekeyhq/shared/src/utils/swapColdStartCacheSnapshotUtils';
import { equalTokenNoCaseSensitive } from '@onekeyhq/shared/src/utils/tokenUtils';
import type {
  ISwapNetwork,
  ISwapToken,
} from '@onekeyhq/shared/types/swap/types';
import { ESwapTabSwitchType } from '@onekeyhq/shared/types/swap/types';

import {
  buildSwapDefaultSelectedTokensForNetwork,
  buildSwapDefaultSelectedTokensFromHomeAccount,
  buildSwapSelectedTokensColdStartAccountKeyFromSelectedAccount,
  getSwapNetworkDefaultTokenPair,
  isSelectedAccountOwnerMatched,
  isSelectedAccountOwnerMatchedIgnoringDeriveType,
  isSwapColdStartAllNetworkContextNetworkId,
  isSwapSelectedTokensColdStartContextMatched,
  isSwapSelectedTokensColdStartContextMatchedWithSelectedAccount,
  isSwapSelectedTokensColdStartOwnerMatchedWithSelectedAccountIgnoringDeriveType,
  shouldResetSelectedTokensForAllNetworkHome,
} from './swapColdStartTokenCacheUtils';

export function isSwapHomeAccountSyncSelectionCurrent({
  homeSelectedAccount,
  selectedAccount,
}: {
  homeSelectedAccount?: IAccountSelectorSelectedAccount;
  selectedAccount?: IAccountSelectorSelectedAccount;
}) {
  return Boolean(
    homeSelectedAccount?.networkId &&
    selectedAccount?.networkId === homeSelectedAccount.networkId &&
    isSelectedAccountOwnerMatchedIgnoringDeriveType(
      homeSelectedAccount,
      selectedAccount,
    ),
  );
}

export function shouldDeferSwapDefaultTokenSeedContextUpdate({
  cachedContext,
  currentContext,
}: {
  cachedContext?: ISwapSelectedTokensColdStartContext;
  currentContext?: ISwapSelectedTokensColdStartContext;
}) {
  return Boolean(
    cachedContext?.defaultTokenSeed &&
    !isSwapSelectedTokensColdStartContextMatched({
      cachedContext,
      currentContext,
    }),
  );
}

export function getSwapDefaultTokenSeedContextForSyncedHomeAccount({
  cachedContext,
  homeSelectedAccount,
  selectedAccount,
  fromToken,
  toToken,
}: {
  cachedContext?: ISwapSelectedTokensColdStartContext;
  homeSelectedAccount?: IAccountSelectorSelectedAccount;
  selectedAccount?: IAccountSelectorSelectedAccount;
  fromToken?: ISwapToken;
  toToken?: ISwapToken;
}): ISwapSelectedTokensColdStartContext | undefined {
  const seed = cachedContext?.defaultTokenSeed;
  if (
    !seed ||
    !cachedContext ||
    !homeSelectedAccount?.networkId ||
    cachedContext.networkId !== homeSelectedAccount.networkId ||
    selectedAccount?.networkId !== homeSelectedAccount.networkId ||
    !isSwapSelectedTokensColdStartOwnerMatchedWithSelectedAccountIgnoringDeriveType(
      { cachedContext, selectedAccount: homeSelectedAccount },
    ) ||
    !isSelectedAccountOwnerMatchedIgnoringDeriveType(
      homeSelectedAccount,
      selectedAccount,
    ) ||
    (seed.fromToken
      ? !equalTokenNoCaseSensitive({
          token1: seed.fromToken,
          token2: fromToken,
        })
      : Boolean(fromToken)) ||
    (seed.toToken
      ? !equalTokenNoCaseSensitive({ token1: seed.toToken, token2: toToken })
      : Boolean(toToken))
  ) {
    return undefined;
  }
  const accountKey =
    buildSwapSelectedTokensColdStartAccountKeyFromSelectedAccount(
      selectedAccount,
    );
  if (!accountKey) {
    return undefined;
  }
  return { ...cachedContext, accountKey };
}

export function getSwapBackendDefaultTokensForSeed({
  cachedContext,
  currentContext,
  fromToken,
  toToken,
  swapNetworks,
  preserveSelectedTokens,
  selectedAccount,
}: {
  cachedContext?: ISwapSelectedTokensColdStartContext;
  currentContext?: ISwapSelectedTokensColdStartContext;
  fromToken?: ISwapToken;
  toToken?: ISwapToken;
  swapNetworks: ISwapNetwork[];
  preserveSelectedTokens: boolean;
  selectedAccount?: IAccountSelectorSelectedAccount;
}) {
  const seed = cachedContext?.defaultTokenSeed;
  if (
    !seed ||
    preserveSelectedTokens ||
    isSwapSelectedTokensColdStartContextMatchedWithSelectedAccount({
      cachedContext,
      selectedAccount,
    }) !== true ||
    !isSwapSelectedTokensColdStartContextMatched({
      cachedContext,
      currentContext,
    }) ||
    !currentContext ||
    (currentContext.swapType !== ESwapTabSwitchType.SWAP &&
      currentContext.swapType !== ESwapTabSwitchType.BRIDGE) ||
    !equalTokenNoCaseSensitive({ token1: seed.fromToken, token2: fromToken }) ||
    !equalTokenNoCaseSensitive({ token1: seed.toToken, token2: toToken }) ||
    !getSwapNetworkDefaultTokenPair(
      swapNetworks.find(
        (network) => network.networkId === currentContext.networkId,
      ),
    )
  ) {
    return undefined;
  }
  return buildSwapDefaultSelectedTokensForNetwork({
    networkId: currentContext.networkId,
    swapType: cachedContext?.swapType,
    swapNetworks,
  });
}

export function shouldClearSwapSelectedTokensBeforeHomeAccountSync({
  cachedContext,
  hasSelectedTokens,
  homeSelectedAccount,
  initialSelectedTokensSynced,
  preserveSelectedTokens,
  swapSelectedAccount,
}: {
  cachedContext?: ISwapSelectedTokensColdStartContext;
  hasSelectedTokens: boolean;
  homeSelectedAccount?: IAccountSelectorSelectedAccount;
  initialSelectedTokensSynced?: boolean;
  preserveSelectedTokens?: boolean;
  swapSelectedAccount?: IAccountSelectorSelectedAccount;
}) {
  if (!hasSelectedTokens) {
    return false;
  }

  if (preserveSelectedTokens) {
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

  if (
    isSwapSelectedTokensColdStartOwnerMatchedWithSelectedAccountIgnoringDeriveType(
      {
        cachedContext,
        selectedAccount: homeSelectedAccount,
      },
    )
  ) {
    return false;
  }

  if (
    shouldResetSelectedTokensForAllNetworkHome({
      cachedContext,
      selectedAccount: homeSelectedAccount,
    })
  ) {
    return true;
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

export function getSwapSelectedTokensHomeAccountSyncAction({
  cachedContext,
  deferSelectedTokenSync,
  hasSelectedTokens,
  homeSelectedAccount,
  initialSelectedTokensSynced,
  preserveSelectedTokens,
  swapSelectedAccount,
  swapType,
  swapNetworks,
  now,
}: {
  cachedContext?: ISwapSelectedTokensColdStartContext;
  deferSelectedTokenSync?: boolean;
  hasSelectedTokens: boolean;
  homeSelectedAccount?: IAccountSelectorSelectedAccount;
  initialSelectedTokensSynced?: boolean;
  preserveSelectedTokens?: boolean;
  swapSelectedAccount?: IAccountSelectorSelectedAccount;
  swapType: ESwapTabSwitchType;
  swapNetworks?: ISwapNetwork[];
  now?: number;
}):
  | {
      type: 'preserve';
    }
  | {
      type: 'replace-with-defaults';
      defaultTokens: NonNullable<
        ReturnType<typeof buildSwapDefaultSelectedTokensFromHomeAccount>
      >;
    }
  | {
      type: 'clear';
    } {
  if (deferSelectedTokenSync || swapType === ESwapTabSwitchType.STOCK) {
    return { type: 'preserve' };
  }

  const shouldClearSelectedTokens =
    shouldClearSwapSelectedTokensBeforeHomeAccountSync({
      cachedContext,
      hasSelectedTokens,
      homeSelectedAccount,
      initialSelectedTokensSynced,
      preserveSelectedTokens,
      swapSelectedAccount,
    });
  if (!shouldClearSelectedTokens) {
    return { type: 'preserve' };
  }

  const defaultTokens = buildSwapDefaultSelectedTokensFromHomeAccount({
    homeSelectedAccount,
    swapType,
    swapNetworks,
    now,
  });
  if (defaultTokens) {
    return { type: 'replace-with-defaults', defaultTokens };
  }

  return { type: 'clear' };
}
