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
