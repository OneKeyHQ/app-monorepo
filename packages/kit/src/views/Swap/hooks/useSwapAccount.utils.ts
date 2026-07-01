import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import { ESwapDirectionType } from '@onekeyhq/shared/types/swap/types';

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
