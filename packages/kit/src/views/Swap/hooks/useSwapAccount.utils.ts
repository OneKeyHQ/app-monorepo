import type { IAccountDeriveTypes } from '@onekeyhq/kit-bg/src/vaults/types';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import { equalsIgnoreCase } from '@onekeyhq/shared/src/utils/stringUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import {
  ESwapDirectionType,
  ESwapTabSwitchType,
} from '@onekeyhq/shared/types/swap/types';

import type { IAccountSelectorActiveAccountInfo } from '../../../states/jotai/contexts/accountSelector';

const SWAP_TARGET_DERIVE_TYPE_RETRY_DELAY_MS = 500;

type IShouldUseSwapCustomRecipientAddressParams = {
  type: ESwapDirectionType;
  swapToAnotherAccountSwitchOn: boolean;
  selectedRecipientAddress?: string;
  selectedRecipientNetworkId?: string;
  activeNetworkId?: string;
  tokenNetworkId?: string;
  isAllNetwork: boolean;
};

type IShouldShowSwapRecipientAddressInfoParams = {
  swapToAnotherAccountSwitchOn: boolean;
  selectedRecipientAddress?: string;
  selectedRecipientNetworkId?: string;
  toAddressNetworkId?: string;
  toTokenNetworkId?: string;
};

type IShouldUseSwapAddressForTokenFetchParams = {
  address?: string;
  activeNetworkId?: string;
  resolvedAddressNetworkId?: string;
  targetNetworkId?: string;
};

type IShouldResetSwapRecipientOnAccountNetworkSyncParams = {
  selectedRecipientAddress?: string;
  selectedRecipientNetworkId?: string;
  hasTargetWallet?: boolean;
  targetAccountId?: string;
  sourceAccountId?: string;
  providerSupportReceiveAddress?: boolean;
};

type IGetSwapRecipientValidationAccountIdParams = {
  accountId?: string;
  accountAddress?: string;
  recipientAddress?: string;
};

type IGetSwapRecipientEditorAccountInfoParams = {
  recipientAccountInfo?: IAccountSelectorActiveAccountInfo;
  activeAccount?: IAccountSelectorActiveAccountInfo;
};

type IGetSwapAddressAccountSelectorNumParams = {
  type: ESwapDirectionType;
  swapToAnotherAccountSwitchOn: boolean;
};

type IGetSwapRecipientActionStateParams = {
  isActionDisabled: boolean;
  isRefreshAction: boolean;
  noConnectWallet: boolean;
  hasQuoteToAmount: boolean;
  recipientAddress?: string;
  isAddressInfoReady: boolean;
  providerSupportReceiveAddress?: boolean;
};

export async function resolveSwapTargetNetworkAccount<TAccount>({
  getDeriveType,
  getNetworkAccount,
}: {
  getDeriveType: () => Promise<IAccountDeriveTypes>;
  getNetworkAccount: (deriveType: IAccountDeriveTypes) => Promise<TAccount>;
}) {
  let deriveType: IAccountDeriveTypes;
  try {
    deriveType = await getDeriveType();
  } catch {
    await timerUtils.wait(SWAP_TARGET_DERIVE_TYPE_RETRY_DELAY_MS);
    deriveType = await getDeriveType();
  }
  try {
    return {
      account: await getNetworkAccount(deriveType),
      deriveType,
    };
  } catch {
    return {
      account: undefined,
      deriveType,
    };
  }
}

export function getSwapRecipientActionState({
  isActionDisabled,
  isRefreshAction,
  noConnectWallet,
  hasQuoteToAmount,
  recipientAddress,
  isAddressInfoReady,
  providerSupportReceiveAddress,
}: IGetSwapRecipientActionStateParams) {
  const needsRecipient =
    !isRefreshAction &&
    !noConnectWallet &&
    hasQuoteToAmount &&
    !recipientAddress;
  if (!needsRecipient) {
    return {
      shouldEnterRecipient: false,
      shouldDisableAction: isActionDisabled,
    };
  }

  const shouldEnterRecipient = Boolean(
    !isActionDisabled && isAddressInfoReady && providerSupportReceiveAddress,
  );
  return {
    shouldEnterRecipient,
    shouldDisableAction: !shouldEnterRecipient,
  };
}

export function getSwapRecipientEditorAccountInfo({
  recipientAccountInfo,
  activeAccount,
}: IGetSwapRecipientEditorAccountInfoParams) {
  if (recipientAccountInfo?.ready) {
    return recipientAccountInfo;
  }

  if (activeAccount?.ready) {
    return activeAccount;
  }

  return undefined;
}

type IShouldShowSwapRecipientEntryParams = {
  swapType: ESwapTabSwitchType;
  incognitoMode: boolean;
  recipientAddressSettingOn: boolean;
  recipientRequired: boolean;
  providerSupportReceiveAddress: boolean;
  hasFromToken: boolean;
  hasToToken: boolean;
};

export function shouldShowSwapRecipientEntry({
  swapType,
  incognitoMode,
  recipientAddressSettingOn,
  recipientRequired,
  providerSupportReceiveAddress,
  hasFromToken,
  hasToToken,
}: IShouldShowSwapRecipientEntryParams) {
  // Incognito mode has its own inline recipient input on Swap/Bridge.
  const incognitoAllows =
    swapType === ESwapTabSwitchType.LIMIT ||
    swapType === ESwapTabSwitchType.STOCK ||
    !incognitoMode;
  return Boolean(
    incognitoAllows &&
    // The recipient is mandatory when the target chain has no account
    // address (e.g. a single-network private-key wallet doing a
    // cross-chain swap), so surface the entry even while the custom
    // recipient setting is off. (OK-58326)
    (recipientAddressSettingOn || recipientRequired) &&
    providerSupportReceiveAddress &&
    hasFromToken &&
    hasToToken,
  );
}

type ISettledSwapRecipientRequired = {
  scopeKey: string;
  value: boolean;
};

type IResolveSettledSwapRecipientRequiredParams = {
  previous: ISettledSwapRecipientRequired;
  scopeKey: string;
  quoteSettled: boolean;
  isAddressInfoReady: boolean;
  recipientRequiredNow: boolean;
};

/**
 * Holds the "a recipient must be entered" verdict across a quote cycle so the
 * recipient entry does not collapse and re-expand on every refresh, while
 * still belonging to exactly one quote scope: switching tab clears the quote
 * list and resets quoteEventCompleted without settling a quote, so a stale
 * verdict would otherwise leak into the next tab. (OK-58326)
 */
export function resolveSettledSwapRecipientRequired({
  previous,
  scopeKey,
  quoteSettled,
  isAddressInfoReady,
  recipientRequiredNow,
}: IResolveSettledSwapRecipientRequiredParams): ISettledSwapRecipientRequired {
  if (previous.scopeKey !== scopeKey) {
    return { scopeKey, value: false };
  }
  if (quoteSettled && isAddressInfoReady) {
    return { scopeKey, value: recipientRequiredNow };
  }
  return previous;
}

export function getSwapRecipientValidationAccountId({
  accountId,
  accountAddress,
  recipientAddress,
}: IGetSwapRecipientValidationAccountIdParams) {
  if (!accountId || !accountAddress || !recipientAddress) {
    return undefined;
  }

  return equalsIgnoreCase(accountAddress, recipientAddress)
    ? accountId
    : undefined;
}

export function getSwapAddressAccountSelectorNum({
  type,
  swapToAnotherAccountSwitchOn,
}: IGetSwapAddressAccountSelectorNumParams) {
  // Without an explicit recipient, both addresses must belong to the source
  // account even if the account-selector TO slot is temporarily stale.
  if (type === ESwapDirectionType.TO && swapToAnotherAccountSwitchOn) {
    return 1;
  }
  return 0;
}

function areSwapRecipientNetworksCompatible({
  selectedRecipientNetworkId,
  targetNetworkId,
}: {
  selectedRecipientNetworkId?: string;
  targetNetworkId?: string;
}) {
  if (!selectedRecipientNetworkId || !targetNetworkId) {
    return false;
  }

  return (
    networkUtils.getNetworkImplOrNetworkId({
      networkId: selectedRecipientNetworkId,
    }) ===
    networkUtils.getNetworkImplOrNetworkId({
      networkId: targetNetworkId,
    })
  );
}

export function shouldResetSwapRecipientOnAccountNetworkSync({
  selectedRecipientAddress,
  selectedRecipientNetworkId,
  hasTargetWallet,
  targetAccountId,
  sourceAccountId,
  providerSupportReceiveAddress,
}: IShouldResetSwapRecipientOnAccountNetworkSyncParams) {
  if (!selectedRecipientNetworkId && !targetAccountId && hasTargetWallet) {
    return true;
  }

  if (providerSupportReceiveAddress === false) {
    return true;
  }

  if (!selectedRecipientAddress && targetAccountId !== sourceAccountId) {
    return true;
  }

  // A temporary token-network mismatch must not delete the saved recipient when
  // switching between Swap, Limit, and Stock.
  return false;
}

export function shouldUseSwapCustomRecipientAddress({
  type,
  swapToAnotherAccountSwitchOn,
  selectedRecipientAddress,
  selectedRecipientNetworkId,
  activeNetworkId,
  tokenNetworkId,
  isAllNetwork,
}: IShouldUseSwapCustomRecipientAddressParams) {
  if (type !== ESwapDirectionType.TO) {
    return false;
  }

  if (
    !swapToAnotherAccountSwitchOn ||
    !selectedRecipientAddress ||
    !selectedRecipientNetworkId
  ) {
    return false;
  }

  if (isAllNetwork) {
    return areSwapRecipientNetworksCompatible({
      selectedRecipientNetworkId,
      targetNetworkId: tokenNetworkId,
    });
  }

  return (
    areSwapRecipientNetworksCompatible({
      selectedRecipientNetworkId,
      targetNetworkId: activeNetworkId,
    }) ||
    areSwapRecipientNetworksCompatible({
      selectedRecipientNetworkId,
      targetNetworkId: tokenNetworkId,
    })
  );
}

export function shouldShowSwapRecipientAddressInfo({
  swapToAnotherAccountSwitchOn,
  selectedRecipientAddress,
  selectedRecipientNetworkId,
  toAddressNetworkId,
  toTokenNetworkId,
}: IShouldShowSwapRecipientAddressInfoParams) {
  if (
    !swapToAnotherAccountSwitchOn ||
    !selectedRecipientAddress ||
    !selectedRecipientNetworkId
  ) {
    return false;
  }

  return areSwapRecipientNetworksCompatible({
    selectedRecipientNetworkId,
    targetNetworkId: toTokenNetworkId ?? toAddressNetworkId,
  });
}

export function shouldUseSwapAddressForTokenFetch({
  address,
  activeNetworkId,
  resolvedAddressNetworkId,
  targetNetworkId,
}: IShouldUseSwapAddressForTokenFetchParams) {
  if (!address || !resolvedAddressNetworkId || !targetNetworkId) {
    return false;
  }

  if (networkUtils.isAllNetwork({ networkId: activeNetworkId })) {
    return resolvedAddressNetworkId === targetNetworkId;
  }

  return (
    activeNetworkId === targetNetworkId &&
    resolvedAddressNetworkId === targetNetworkId
  );
}
