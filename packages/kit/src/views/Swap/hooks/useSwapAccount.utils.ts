import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import {
  ESwapDirectionType,
  ESwapTabSwitchType,
} from '@onekeyhq/shared/types/swap/types';

import type { IAccountSelectorActiveAccountInfo } from '../../../states/jotai/contexts/accountSelector';

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

type IGetSwapAddressAccountSelectorNumParams = {
  type: ESwapDirectionType;
  swapToAnotherAccountSwitchOn: boolean;
};

type IGetSwapRecipientEditorAccountInfoParams = {
  recipientAccountInfo?: IAccountSelectorActiveAccountInfo;
  activeAccount?: IAccountSelectorActiveAccountInfo;
};

type IGetSwapRecipientEditorAccountIdParams = {
  editorAccountInfo?: IAccountSelectorActiveAccountInfo;
  targetNetworkId?: string;
};

type IShouldRequireSwapRecipientAddressParams = {
  fromNetworkId?: string;
  toNetworkId?: string;
  fromAddress?: string;
  toAddress?: string;
  hasActionableQuote: boolean;
  hasSelectedRecipient: boolean;
  isAddressInfoReady: boolean;
  incognitoMode: boolean;
  providerSupportsRecipient: boolean;
  swapType: ESwapTabSwitchType;
  targetCanCreateAddress?: boolean;
};

type IShouldActivateSwapCustomRecipientAddressParams = {
  type: ESwapDirectionType;
  swapToAnotherAccountSwitchOn: boolean;
  selectedRecipientAddress?: string;
  swapEnableRecipientAddress: boolean;
  fromNetworkId?: string;
  toNetworkId?: string;
  incognitoMode: boolean;
  providerSupportsRecipient: boolean;
  swapType: ESwapTabSwitchType;
  targetCanCreateAddress?: boolean;
};

export function shouldRequireSwapRecipientAddress({
  fromNetworkId,
  toNetworkId,
  fromAddress,
  toAddress,
  hasActionableQuote,
  hasSelectedRecipient,
  isAddressInfoReady,
  incognitoMode,
  providerSupportsRecipient,
  swapType,
  targetCanCreateAddress,
}: IShouldRequireSwapRecipientAddressParams) {
  if (
    incognitoMode ||
    swapType === ESwapTabSwitchType.LIMIT ||
    swapType === ESwapTabSwitchType.STOCK
  ) {
    return false;
  }

  return Boolean(
    fromNetworkId &&
    toNetworkId &&
    fromNetworkId !== toNetworkId &&
    fromAddress &&
    providerSupportsRecipient &&
    targetCanCreateAddress === false &&
    (hasSelectedRecipient ||
      (isAddressInfoReady && !toAddress && hasActionableQuote)),
  );
}

export function shouldActivateSwapCustomRecipientAddress({
  type,
  swapToAnotherAccountSwitchOn,
  selectedRecipientAddress,
  swapEnableRecipientAddress,
  fromNetworkId,
  toNetworkId,
  incognitoMode,
  providerSupportsRecipient,
  swapType,
  targetCanCreateAddress,
}: IShouldActivateSwapCustomRecipientAddressParams) {
  if (
    type !== ESwapDirectionType.TO ||
    !swapToAnotherAccountSwitchOn ||
    !selectedRecipientAddress ||
    !providerSupportsRecipient
  ) {
    return false;
  }

  if (swapEnableRecipientAddress) {
    return true;
  }

  if (
    incognitoMode ||
    swapType === ESwapTabSwitchType.LIMIT ||
    swapType === ESwapTabSwitchType.STOCK
  ) {
    return false;
  }

  return Boolean(
    fromNetworkId &&
    toNetworkId &&
    fromNetworkId !== toNetworkId &&
    targetCanCreateAddress === false,
  );
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

export function getSwapRecipientEditorAccountId({
  editorAccountInfo,
  targetNetworkId,
}: IGetSwapRecipientEditorAccountIdParams) {
  const account = editorAccountInfo?.account;
  const accountNetworkId = account?.addressDetail?.networkId;

  if (
    !account?.id ||
    !areSwapRecipientNetworksCompatible({
      selectedRecipientNetworkId: accountNetworkId,
      targetNetworkId,
    })
  ) {
    return undefined;
  }

  return account.id;
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
