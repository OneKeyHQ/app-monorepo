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

  return (
    isAllNetwork ||
    activeNetworkId === selectedRecipientNetworkId ||
    tokenNetworkId === selectedRecipientNetworkId
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

  return (
    selectedRecipientNetworkId === (toTokenNetworkId ?? toAddressNetworkId)
  );
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
